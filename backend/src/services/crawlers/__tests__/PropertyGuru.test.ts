import { PropertyGuruCrawler } from '../PropertyGuru';
import { BaseCrawler } from '../BaseCrawler';

// Mock the BaseCrawler
jest.mock('../BaseCrawler');

describe('PropertyGuruCrawler', () => {
  let crawler: PropertyGuruCrawler;
  let mockMakeRequest: jest.Mock;

  const mockSearchHtml = `
    <html>
      <body>
        <div class="article-card">
          <a href="/property-guides/new-condo-launch-orchard">New Condo Launch in Orchard</a>
        </div>
        <div class="news-item">
          <a href="/property-guides/hdb-development-tampines">HDB Development in Tampines</a>
        </div>
        <div class="guide-item">
          <a href="/calculator/mortgage-calculator">Mortgage Calculator</a>
        </div>
      </body>
    </html>
  `;

  const mockNewsHtml = `
    <html>
      <body>
        <div class="news-list">
          <div class="news-item">
            <a href="/property-guides/news/infrastructure-project">
              <div class="title">Infrastructure Project Development</div>
            </a>
          </div>
          <div class="news-item">
            <a href="/property-guides/news/new-launch-announcement">
              <h3>New Launch Announcement</h3>
            </a>
          </div>
        </div>
      </body>
    </html>
  `;

  const mockArticleHtml = `
    <html>
      <head>
        <title>New Condo Launch in Orchard</title>
      </head>
      <body>
        <h1 class="article-title">New Condo Launch in Orchard</h1>
        <div class="article-date">
          <time datetime="2024-03-05T14:20:00+08:00">March 5, 2024</time>
        </div>
        <div class="article-content">
          <p>A new luxury condominium development will be launched in the prime Orchard district.</p>
          <p>The project features modern amenities and excellent connectivity to the city center.</p>
        </div>
      </body>
    </html>
  `;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockMakeRequest = jest.fn();
    
    // Mock the BaseCrawler constructor and methods
    (BaseCrawler as any).mockImplementation(() => ({
      makeRequest: mockMakeRequest,
      parseDate: jest.fn().mockImplementation((dateStr: string) => new Date(dateStr)),
      cleanText: jest.fn().mockImplementation((text: string) => text.trim()),
      config: {
        baseURL: 'https://www.propertyguru.com.sg',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: 2000
      }
    } as any));

    crawler = new PropertyGuruCrawler();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(BaseCrawler).toHaveBeenCalledWith({
        baseURL: 'https://www.propertyguru.com.sg',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: 2000
      });
    });
  });

  describe('searchArticles', () => {
    it('should search for property-related development articles', async () => {
      mockMakeRequest
        .mockResolvedValue(mockSearchHtml)
        .mockResolvedValueOnce(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/search?q=Orchard%20new%20development');
      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/search?q=Orchard%20property%20development');
      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/search?q=Orchard%20condo%20launch');
      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/search?q=Orchard%20HDB%20development');
      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/search?q=Orchard%20infrastructure%20project');
    });

    it('should also search the news section', async () => {
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml) // First search
        .mockResolvedValueOnce(mockNewsHtml)   // News section
        .mockResolvedValue(mockArticleHtml);   // Article content

      const fromDate = new Date('2024-01-01');
      await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/news');
    });

    it('should extract articles from search results', async () => {
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml)
        .mockResolvedValueOnce(mockNewsHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(expect.objectContaining({
        title: 'New Condo Launch in Orchard',
        content: expect.stringContaining('luxury condominium'),
        source: 'PropertyGuru'
      }));
    });

    it('should handle search failures gracefully', async () => {
      mockMakeRequest.mockRejectedValue(new Error('Search request failed'));

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result).toEqual([]);
    });

    it('should deduplicate articles with same URL', async () => {
      const duplicateSearchHtml = `
        <html>
          <body>
            <div class="article-card">
              <a href="/property-guides/same-article">Same Article</a>
            </div>
            <div class="news-item">
              <a href="/property-guides/same-article">Same Article Different Context</a>
            </div>
          </body>
        </html>
      `;

      mockMakeRequest
        .mockResolvedValue(duplicateSearchHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should only have one instance of the article despite multiple links
      const uniqueUrls = new Set(result.map(article => article.url));
      expect(uniqueUrls.size).toBe(result.length);
    });

    it('should limit articles per search to 8', async () => {
      const manyLinksHtml = `
        <html><body>
          ${Array.from({ length: 12 }, (_, i) => 
            `<div class="article-card"><a href="/property-guides/article-${i}">Article ${i}</a></div>`
          ).join('')}
        </body></html>
      `;

      mockMakeRequest
        .mockResolvedValueOnce(manyLinksHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should only fetch first 8 articles per search (plus search requests and news section)
      expect(mockMakeRequest).toHaveBeenCalledTimes(10); // 1 search + 1 news + 8 articles
    });
  });

  describe('searchNewsSection', () => {
    it('should search news section for relevant articles', async () => {
      mockMakeRequest.mockResolvedValue(mockNewsHtml);

      const result = await crawler['searchNewsSection']('development', new Date('2024-01-01'));

      expect(mockMakeRequest).toHaveBeenCalledWith('/property-guides/news');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter articles by title relevance', async () => {
      const newsWithRelevantTitles = `
        <html>
          <body>
            <div class="news-list">
              <div class="news-item">
                <a href="/property-guides/news/orchard-development">
                  <div class="title">Orchard Development Project</div>
                </a>
              </div>
              <div class="news-item">
                <a href="/property-guides/news/unrelated-news">
                  <h3>Unrelated Property News</h3>
                </a>
              </div>
              <div class="news-item">
                <a href="/property-guides/news/infrastructure-update">
                  <h4>Infrastructure Update</h4>
                </a>
              </div>
            </div>
          </body>
        </html>
      `;

      mockMakeRequest.mockResolvedValue(newsWithRelevantTitles);

      const result = await crawler['searchNewsSection']('orchard', new Date('2024-01-01'));

      // Should include articles with relevant keywords in title
      expect(result.length).toBeGreaterThanOrEqual(2); // Orchard + Infrastructure
    });

    it('should handle news section failures gracefully', async () => {
      mockMakeRequest.mockRejectedValue(new Error('News section failed'));

      const result = await crawler['searchNewsSection']('orchard', new Date('2024-01-01'));

      expect(result).toEqual([]);
    });
  });

  describe('extractArticleData', () => {
    it('should extract article data with PropertyGuru selectors', () => {
      const result = crawler['extractArticleData'](mockArticleHtml, 'https://test.com/article');

      expect(result).toEqual({
        title: 'New Condo Launch in Orchard',
        content: expect.stringContaining('luxury condominium'),
        url: 'https://test.com/article',
        publishDate: expect.any(Date),
        source: 'PropertyGuru'
      });
    });

    it('should handle alternative content selectors', () => {
      const alternativeHtml = `
        <html>
          <body>
            <h1 class="guide-title">Guide Title Layout</h1>
            <div class="publish-date">
              <time datetime="2024-04-10T10:30:00+08:00">April 10, 2024</time>
            </div>
            <div class="guide-content">
              <p>Content in guide layout structure</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](alternativeHtml, 'https://test.com/article');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Guide Title Layout');
      expect(result?.content).toContain('guide layout');
    });

    it('should return null for articles without title', () => {
      const htmlWithoutTitle = '<html><body><p>Content without title</p></body></html>';
      
      const result = crawler['extractArticleData'](htmlWithoutTitle, 'https://test.com/article');

      expect(result).toBeNull();
    });

    it('should return null for articles without content', () => {
      const htmlWithoutContent = '<html><body><h1 class="article-title">Title Only</h1></body></html>';
      
      const result = crawler['extractArticleData'](htmlWithoutContent, 'https://test.com/article');

      expect(result).toBeNull();
    });

    it('should extract date from data-date attribute', () => {
      const htmlWithDataDate = `
        <html>
          <body>
            <h1 class="article-title">Test Article</h1>
            <div data-date="2024-05-15T12:00:00+08:00">May 15, 2024</div>
            <div class="content-body">
              <p>Test content</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](htmlWithDataDate, 'https://test.com/article');

      expect(result?.publishDate).toBeInstanceOf(Date);
    });

    it('should handle news content selectors', () => {
      const newsHtml = `
        <html>
          <body>
            <h1 class="news-title">News Article Title</h1>
            <div class="news-date">
              <time datetime="2024-06-01T15:45:00+08:00">June 1, 2024</time>
            </div>
            <div class="news-content">
              <p>News article content</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](newsHtml, 'https://test.com/article');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('News Article Title');
      expect(result?.content).toContain('News article content');
    });
  });

  describe('URL validation', () => {
    it('should accept valid article URLs', () => {
      const validUrls = [
        '/property-guides/new-development-guide',
        '/property-guides/market-analysis',
        '/news/property-market-update'
      ];

      validUrls.forEach(url => {
        const isValid = crawler['isValidArticleUrl'](url);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid article URLs', () => {
      const invalidUrls = [
        '/property-for-sale/condo-listing',
        '/property-for-rent/apartment-rental',
        '/new-launches/upcoming-projects',
        '/calculator/affordability-calculator',
        '/mortgage/loan-application'
      ];

      invalidUrls.forEach(url => {
        const isValid = crawler['isValidArticleUrl'](url);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('date filtering', () => {
    it('should accept recent articles', () => {
      const recentDate = new Date('2024-03-05');
      const fromDate = new Date('2024-01-01');
      
      const isRecent = crawler['isRecentArticle'](recentDate, fromDate);
      
      expect(isRecent).toBe(true);
    });

    it('should reject old articles', () => {
      const oldDate = new Date('2023-10-15');
      const fromDate = new Date('2024-01-01');
      
      const isRecent = crawler['isRecentArticle'](oldDate, fromDate);
      
      expect(isRecent).toBe(false);
    });

    it('should accept articles on boundary date', () => {
      const boundaryDate = new Date('2024-01-01');
      const fromDate = new Date('2024-01-01');
      
      const isRecent = crawler['isRecentArticle'](boundaryDate, fromDate);
      
      expect(isRecent).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle article fetch failures', async () => {
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml) // Search succeeds
        .mockResolvedValueOnce(mockNewsHtml)   // News section succeeds
        .mockRejectedValue(new Error('Article fetch failed')); // Article fetch fails

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result).toEqual([]);
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><div>Incomplete HTML structure';
      
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml)
        .mockResolvedValueOnce(mockNewsHtml)
        .mockResolvedValueOnce(malformedHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result).toEqual([]);
    });

    it('should continue with other queries when one search fails', async () => {
      mockMakeRequest
        .mockRejectedValueOnce(new Error('First search failed'))
        .mockResolvedValueOnce(mockSearchHtml) // Second search succeeds
        .mockResolvedValueOnce(mockNewsHtml)   // News section succeeds
        .mockResolvedValueOnce(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should still process successful searches
      expect(mockMakeRequest).toHaveBeenCalledTimes(4); // 2 searches + 1 news + 1 article
    });

    it('should handle empty search results', async () => {
      const emptySearchHtml = '<html><body><div>No results found</div></body></html>';
      
      mockMakeRequest.mockResolvedValue(emptySearchHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('NonexistentArea', 'NonexistentArea', fromDate);

      expect(result).toEqual([]);
    });

    it('should handle news section search failures gracefully', async () => {
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml) // Main search succeeds
        .mockRejectedValueOnce(new Error('News section failed')) // News section fails
        .mockResolvedValueOnce(mockArticleHtml); // Article fetch succeeds

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should still get results from main search
      expect(result.length).toBeGreaterThan(0);
    });
  });
});