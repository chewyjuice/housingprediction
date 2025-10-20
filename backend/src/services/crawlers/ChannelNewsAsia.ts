import * as cheerio from 'cheerio';
import { BaseCrawler, CrawlerConfig, ArticleData } from './BaseCrawler';

export class ChannelNewsAsiaCrawler extends BaseCrawler {
  constructor() {
    const config: CrawlerConfig = {
      baseURL: 'https://www.channelnewsasia.com',
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
      // Search for development-related keywords in the area
      const searchQueries = [
        `${areaName} development`,
        `${areaName} school`,
        `${areaName} infrastructure`,
        `${areaName} shopping centre`,
        `${areaName} office building`
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
      console.error('Error searching Channel NewsAsia articles:', error);
      return [];
    }
  }

  private async performSearch(query: string, fromDate: Date): Promise<ArticleData[]> {
    const articles: ArticleData[] = [];
    
    try {
      // Use CNA search endpoint
      const searchUrl = `/search?q=${encodeURIComponent(query)}`;
      const searchHtml = await this.makeRequest(searchUrl);
      
      const $ = cheerio.load(searchHtml);
      
      // Extract article links from search results
      const articleLinks: string[] = [];
      $('.list-object h6 a, .teaser__headline a, .search-result-item a').each((_, element) => {
        const href = $(element).attr('href');
        if (href && this.isValidArticleUrl(href)) {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseURL}${href}`;
          articleLinks.push(fullUrl);
        }
      });

      // Fetch and parse each article
      for (const url of articleLinks.slice(0, 10)) { // Limit to 10 articles per search
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
      const title = $('h1.content-detail__title, .article__title h1, .h1--page-title').first().text().trim();
      if (!title) {
        return null;
      }

      // Extract content
      const contentSelectors = [
        '.text-long p',
        '.content-detail__body p',
        '.article__body p',
        '.article-content p'
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
        '.content-detail__date time',
        '.article__date time',
        '.byline time',
        '[data-testid="publish-date"]'
      ];

      for (const selector of dateSelectors) {
        const dateElement = $(selector).first();
        if (dateElement.length > 0) {
          const dateStr = dateElement.attr('datetime') || dateElement.text();
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
        source: 'Channel NewsAsia'
      };
    } catch (error) {
      console.warn(`Failed to extract article data from ${url}:`, error);
      return null;
    }
  }

  private isValidArticleUrl(url: string): boolean {
    // Filter out non-article URLs
    const invalidPatterns = [
      '/videos/',
      '/photos/',
      '/live-updates/',
      '/commentary/',
      '/watch/'
    ];
    
    return !invalidPatterns.some(pattern => url.includes(pattern)) &&
           (url.includes('/singapore/') || url.includes('/business/') || url.includes('/asia/'));
  }

  private isRecentArticle(publishDate: Date, fromDate: Date): boolean {
    return publishDate >= fromDate;
  }
}