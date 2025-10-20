import * as cheerio from 'cheerio';
import { BaseCrawler, CrawlerConfig, ArticleData } from './BaseCrawler';

export class PropertyGuruCrawler extends BaseCrawler {
  constructor() {
    const config: CrawlerConfig = {
      baseURL: 'https://www.propertyguru.com.sg',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimit: 2000 // 2 seconds between requests
    };
    super(config);
  }

  async searchArticles(query: string, areaName: string, fromDate: Date): Promise<ArticleData[]> {
    const articles: ArticleData[] = [];
    
    try {
      // Search for property-related development keywords in the area
      const searchQueries = [
        `${areaName} new development`,
        `${areaName} property development`,
        `${areaName} condo launch`,
        `${areaName} HDB development`,
        `${areaName} infrastructure project`
      ];

      for (const searchQuery of searchQueries) {
        try {
          const searchResults = await this.performSearch(searchQuery, fromDate);
          articles.push(...searchResults);
        } catch (error) {
          console.warn(`Search failed for query "${searchQuery}":`, error);
        }
      }

      // Remove duplicates based on URL
      const uniqueArticles = articles.filter((article, index, self) => 
        index === self.findIndex(a => a.url === article.url)
      );

      return uniqueArticles;
    } catch (error) {
      console.error('Error searching PropertyGuru articles:', error);
      return [];
    }
  }

  private async performSearch(query: string, fromDate: Date): Promise<ArticleData[]> {
    const articles: ArticleData[] = [];
    
    try {
      // Use PropertyGuru news search
      const searchUrl = `/property-guides/search?q=${encodeURIComponent(query)}`;
      const searchHtml = await this.makeRequest(searchUrl);
      
      const $ = cheerio.load(searchHtml);
      
      // Extract article links from search results
      const articleLinks: string[] = [];
      $('.article-card a, .news-item a, .guide-item a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && this.isValidArticleUrl(href)) {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseURL}${href}`;
          articleLinks.push(fullUrl);
        }
      });

      // Also try the news section directly
      try {
        const newsResults = await this.searchNewsSection(query, fromDate);
        articles.push(...newsResults);
      } catch (error) {
        console.warn('Failed to search news section:', error);
      }

      // Fetch and parse each article
      for (const url of articleLinks.slice(0, 8)) { // Limit to 8 articles per search
        try {
          const articleData = await this.fetchArticle(url);
          if (articleData && this.isRecentArticle(articleData.publishDate, fromDate)) {
            articles.push(articleData);
          }
        } catch (error) {
          console.warn(`Failed to fetch article ${url}:`, error);
        }
      }
    } catch (error) {
      console.warn(`Search request failed for query "${query}":`, error);
    }

    return articles;
  }

  private async searchNewsSection(query: string, fromDate: Date): Promise<ArticleData[]> {
    const articles: ArticleData[] = [];
    
    try {
      const newsUrl = '/property-guides/news';
      const newsHtml = await this.makeRequest(newsUrl);
      
      const $ = cheerio.load(newsHtml);
      
      // Extract recent news articles
      $('.news-list .news-item a, .article-list .article-item a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && this.isValidArticleUrl(href)) {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseURL}${href}`;
          
          // Check if article title contains relevant keywords
          const title = $(element).find('.title, h3, h4').text().toLowerCase();
          const queryLower = query.toLowerCase();
          
          if (title.includes(queryLower) || 
              title.includes('development') || 
              title.includes('infrastructure') ||
              title.includes('new launch')) {
            articles.push({ url: fullUrl } as any); // Will be filled by fetchArticle
          }
        }
      });
    } catch (error) {
      console.warn('Failed to search news section:', error);
    }

    return articles;
  }

  private async fetchArticle(url: string): Promise<ArticleData | null> {
    try {
      const html = await this.makeRequest(url);
      return this.extractArticleData(html, url);
    } catch (error) {
      console.warn(`Failed to fetch article content from ${url}:`, error);
      return null;
    }
  }

  protected extractArticleData(html: string, url: string): ArticleData | null {
    try {
      const $ = cheerio.load(html);
      
      // Extract title
      const title = $('h1.article-title, .guide-title h1, .news-title h1').first().text().trim();
      if (!title) {
        return null;
      }

      // Extract content
      const contentSelectors = [
        '.article-content p',
        '.guide-content p',
        '.news-content p',
        '.content-body p'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          content = elements.map((_, el) => $(el).text()).get().join(' ');
          break;
        }
      }

      if (!content) {
        return null;
      }

      // Extract publish date
      let publishDate = new Date();
      const dateSelectors = [
        '.article-date time',
        '.publish-date time',
        '.news-date time',
        '[data-date]'
      ];

      for (const selector of dateSelectors) {
        const dateElement = $(selector).first();
        if (dateElement.length > 0) {
          const dateStr = dateElement.attr('datetime') || 
                          dateElement.attr('data-date') || 
                          dateElement.text();
          if (dateStr) {
            publishDate = this.parseDate(dateStr);
            break;
          }
        }
      }

      return {
        title: this.cleanText(title),
        content: this.cleanText(content),
        url,
        publishDate,
        source: 'PropertyGuru'
      };
    } catch (error) {
      console.warn(`Failed to extract article data from ${url}:`, error);
      return null;
    }
  }

  private isValidArticleUrl(url: string): boolean {
    // Filter out non-article URLs
    const invalidPatterns = [
      '/property-for-sale/',
      '/property-for-rent/',
      '/new-launches/',
      '/calculator/',
      '/mortgage/'
    ];
    
    return !invalidPatterns.some(pattern => url.includes(pattern)) &&
           (url.includes('/property-guides/') || url.includes('/news/'));
  }

  private isRecentArticle(publishDate: Date, fromDate: Date): boolean {
    return publishDate >= fromDate;
  }
}