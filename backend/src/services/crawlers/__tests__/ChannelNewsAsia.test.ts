import { ChannelNewsAsiaCrawler } from '../ChannelNewsAsia';
import { BaseCrawler } from '../BaseCrawler';

// Mock the BaseCrawler
jest.mock('../BaseCrawler');

describe('ChannelNewsAsiaCrawler', () => {
  let crawler: ChannelNewsAsiaCrawler;
  let mockMakeRequest: jest.Mock;

  const mockSearchHtml = `
    <html>
      <body>
        <div class="list-object">
          <h6><a href="/singapore/mrt-extension-tampines">MRT Extension to Tampines</a></h6>
        </div>
        <div class="teaser__headline">
          <a href="/business/shopping-centre-jurong">New Shopping Centre in Jurong</a>
        </div>
        <div class="search-result-item">
          <a href="/videos/celebrity-interview">Celebrity Interview</a>
        </div>
      </body>
    </html>
  `;

  const mockArticleHtml = `
    <html>
      <head>
        <title>MRT Extension to Tampines</title>
      </head>
      <body>
        <h1 class="content-detail__title">MRT Extension to Tampines</h1>
        <div class="content-detail__date">
          <time datetime="2024-02-10T09:15:00+08:00">February 10, 2024</time>
        </div>
        <div class="content-detail__body">
          <p>The Land Transport Authority announced plans to extend the MRT line to Tampines.</p>
          <p>This infrastructure project will improve connectivity for residents in the area.</p>
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
        baseURL: 'https://www.channelnewsasia.com',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: 2000
      }
    } as any));

    crawler = new ChannelNewsAsiaCrawler();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(BaseCrawler).toHaveBeenCalledWith({
        baseURL: 'https://www.channelnewsasia.com',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: 2000
      });
    });
  });

  describe('searchArticles', () => {
    it('should search for articles with development-related queries', async () => {
      mockMakeRequest
        .mockResolvedValue(mockSearchHtml)
        .mockResolvedValueOnce(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      expect(mockMakeRequest).toHaveBeenCalledWith('/search?q=Tampines%20development');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?q=Tampines%20school');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?q=Tampines%20infrastructure');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?q=Tampines%20shopping%20centre');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?q=Tampines%20office%20building');
    });

    it('should extract articles from search results', async () => {
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toEqual(expect.objectContaining({
        title: 'MRT Extension to Tampines',
        content: expect.stringContaining('Land Transport Authority'),
        source: 'Channel NewsAsia'
      }));
    });

    it('should handle search failures gracefully', async () => {
      mockMakeRequest.mockRejectedValue(new Error('Search request failed'));

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      expect(result).toEqual([]);
    });

    it('should deduplicate articles with same URL', async () => {
      const duplicateSearchHtml = `
        <html>
          <body>
            <div class="list-object">
              <h6><a href="/singapore/same-article">Same Article</a></h6>
            </div>
            <div class="teaser__headline">
              <a href="/singapore/same-article">Same Article Different Title</a>
            </div>
          </body>
        </html>
      `;

      mockMakeRequest
        .mockResolvedValue(duplicateSearchHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      // Should only have one instance of the article despite multiple links
      const uniqueUrls = new Set(result.map(article => article.url));
      expect(uniqueUrls.size).toBe(result.length);
    });

    it('should limit articles per search to 10', async () => {
      const manyLinksHtml = `
        <html><body>
          ${Array.from({ length: 15 }, (_, i) => 
            `<div class="list-object"><h6><a href="/singapore/article-${i}">Article ${i}</a></h6></div>`
          ).join('')}
        </body></html>
      `;

      mockMakeRequest
        .mockResolvedValueOnce(manyLinksHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      // Should only fetch first 10 articles per search (plus search requests)
      expect(mockMakeRequest).toHaveBeenCalledTimes(11); // 1 search + 10 articles
    });
  });

  describe('extractArticleData', () => {
    it('should extract article data with content-detail selectors', () => {
      const result = crawler['extractArticleData'](mockArticleHtml, 'https://test.com/article');

      expect(result).toEqual({
        title: 'MRT Extension to Tampines',
        content: expect.stringContaining('Land Transport Authority'),
        url: 'https://test.com/article',
        publishDate: expect.any(Date),
        source: 'Channel NewsAsia'
      });
    });

    it('should handle alternative content selectors', () => {
      const alternativeHtml = `
        <html>
          <body>
            <h1 class="article__title">Alternative Title Layout</h1>
            <div class="article__date">
              <time datetime="2024-03-01T11:00:00+08:00">March 1, 2024</time>
            </div>
            <div class="article__body">
              <p>Content in alternative layout structure</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](alternativeHtml, 'https://test.com/article');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Alternative Title Layout');
      expect(result?.content).toContain('alternative layout');
    });

    it('should return null for articles without title', () => {
      const htmlWithoutTitle = '<html><body><p>Content without title</p></body></html>';
      
      const result = crawler['extractArticleData'](htmlWithoutTitle, 'https://test.com/article');

      expect(result).toBeNull();
    });

    it('should return null for articles without content', () => {
      const htmlWithoutContent = '<html><body><h1 class="content-detail__title">Title Only</h1></body></html>';
      
      const result = crawler['extractArticleData'](htmlWithoutContent, 'https://test.com/article');

      expect(result).toBeNull();
    });

    it('should extract date from various date selectors', () => {
      const htmlWithBylineDate = `
        <html>
          <body>
            <h1 class="content-detail__title">Test Article</h1>
            <div class="byline">
              <time datetime="2024-04-15T16:45:00+08:00">April 15, 2024</time>
            </div>
            <div class="text-long">
              <p>Test content</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](htmlWithBylineDate, 'https://test.com/article');

      expect(result?.publishDate).toBeInstanceOf(Date);
    });

    it('should handle testid date selector', () => {
      const htmlWithTestId = `
        <html>
          <body>
            <h1 class="content-detail__title">Test Article</h1>
            <div data-testid="publish-date" datetime="2024-05-20T08:30:00+08:00">May 20, 2024</div>
            <div class="text-long">
              <p>Test content</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](htmlWithTestId, 'https://test.com/article');

      expect(result?.publishDate).toBeInstanceOf(Date);
    });
  });

  describe('URL validation', () => {
    it('should accept valid article URLs', () => {
      const validUrls = [
        '/singapore/infrastructure-development',
        '/business/property-market-news',
        '/asia/regional-development-project'
      ];

      validUrls.forEach(url => {
        const isValid = crawler['isValidArticleUrl'](url);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid article URLs', () => {
      const invalidUrls = [
        '/videos/news-report',
        '/photos/event-gallery',
        '/live-updates/breaking-news',
        '/commentary/opinion-piece',
        '/watch/documentary'
      ];

      invalidUrls.forEach(url => {
        const isValid = crawler['isValidArticleUrl'](url);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('date filtering', () => {
    it('should accept recent articles', () => {
      const recentDate = new Date('2024-02-10');
      const fromDate = new Date('2024-01-01');
      
      const isRecent = crawler['isRecentArticle'](recentDate, fromDate);
      
      expect(isRecent).toBe(true);
    });

    it('should reject old articles', () => {
      const oldDate = new Date('2023-11-15');
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
        .mockRejectedValue(new Error('Article fetch failed')); // Article fetch fails

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      expect(result).toEqual([]);
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><div>Incomplete HTML without proper closing tags';
      
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml)
        .mockResolvedValueOnce(malformedHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      expect(result).toEqual([]);
    });

    it('should continue with other queries when one search fails', async () => {
      mockMakeRequest
        .mockRejectedValueOnce(new Error('First search failed'))
        .mockResolvedValueOnce(mockSearchHtml) // Second search succeeds
        .mockResolvedValueOnce(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Tampines', 'Tampines', fromDate);

      // Should still process successful searches
      expect(mockMakeRequest).toHaveBeenCalledTimes(3); // 2 searches + 1 article
    });

    it('should handle empty search results', async () => {
      const emptySearchHtml = '<html><body><div>No results found</div></body></html>';
      
      mockMakeRequest.mockResolvedValue(emptySearchHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('NonexistentArea', 'NonexistentArea', fromDate);

      expect(result).toEqual([]);
    });
  });
});