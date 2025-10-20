import { StraitsTimesCrawler } from '../StraitsTimes';
import { BaseCrawler } from '../BaseCrawler';

// Mock the BaseCrawler
jest.mock('../BaseCrawler');

describe('StraitsTimesCrawler', () => {
  let crawler: StraitsTimesCrawler;
  let mockMakeRequest: jest.Mock;

  const mockSearchHtml = `
    <html>
      <body>
        <div class="story-headline">
          <a href="/singapore/new-school-development-orchard">New School Development in Orchard</a>
        </div>
        <div class="story-card">
          <a href="/business/infrastructure-project-tampines">Infrastructure Project in Tampines</a>
        </div>
        <div class="search-result">
          <a href="/videos/entertainment-news">Entertainment Video</a>
        </div>
      </body>
    </html>
  `;

  const mockArticleHtml = `
    <html>
      <head>
        <title>New School Development in Orchard</title>
      </head>
      <body>
        <h1 class="headline">New School Development in Orchard</h1>
        <div class="story-postdate">
          <time datetime="2024-01-15T10:30:00+08:00">January 15, 2024</time>
        </div>
        <div class="story-content">
          <div class="text-long">
            <p>The Ministry of Education announced plans for a new primary school in the Orchard district.</p>
            <p>The school will serve the growing population in the area and provide quality education.</p>
          </div>
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
        baseURL: 'https://www.straitstimes.com',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: 2000
      }
    } as any));

    crawler = new StraitsTimesCrawler();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(BaseCrawler).toHaveBeenCalledWith({
        baseURL: 'https://www.straitstimes.com',
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        rateLimit: 2000
      });
    });
  });

  describe('searchArticles', () => {
    it('should search for articles with multiple queries', async () => {
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml) // First search query
        .mockResolvedValueOnce(mockSearchHtml) // Second search query
        .mockResolvedValueOnce(mockSearchHtml) // Third search query
        .mockResolvedValueOnce(mockSearchHtml) // Fourth search query
        .mockResolvedValueOnce(mockSearchHtml) // Fifth search query
        .mockResolvedValueOnce(mockArticleHtml) // Article content
        .mockResolvedValueOnce(mockArticleHtml); // Article content (duplicate)

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(mockMakeRequest).toHaveBeenCalledWith('/search?query=Orchard%20development');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?query=Orchard%20school');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?query=Orchard%20infrastructure');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?query=Orchard%20shopping%20mall');
      expect(mockMakeRequest).toHaveBeenCalledWith('/search?query=Orchard%20business%20office');
    });

    it('should extract and deduplicate articles', async () => {
      mockMakeRequest
        .mockResolvedValue(mockSearchHtml)
        .mockResolvedValueOnce(mockArticleHtml)
        .mockResolvedValueOnce(mockArticleHtml); // Same article twice

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should deduplicate based on URL
      expect(result.length).toBeLessThanOrEqual(2); // At most 2 unique articles
    });

    it('should handle search failures gracefully', async () => {
      mockMakeRequest.mockRejectedValue(new Error('Search failed'));

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result).toEqual([]);
    });

    it('should limit articles per search query', async () => {
      // Create HTML with many article links
      const manyLinksHtml = `
        <html><body>
          ${Array.from({ length: 20 }, (_, i) => 
            `<div class="story-headline"><a href="/singapore/article-${i}">Article ${i}</a></div>`
          ).join('')}
        </body></html>
      `;

      mockMakeRequest
        .mockResolvedValueOnce(manyLinksHtml)
        .mockResolvedValue(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should only fetch first 10 articles per search (plus search requests)
      expect(mockMakeRequest).toHaveBeenCalledTimes(11); // 1 search + 10 articles
    });
  });

  describe('extractArticleData', () => {
    it('should extract article data correctly', () => {
      const result = crawler['extractArticleData'](mockArticleHtml, 'https://test.com/article');

      expect(result).toEqual({
        title: 'New School Development in Orchard',
        content: expect.stringContaining('Ministry of Education'),
        url: 'https://test.com/article',
        publishDate: expect.any(Date),
        source: 'The Straits Times'
      });
    });

    it('should return null for articles without title', () => {
      const htmlWithoutTitle = '<html><body><p>Content without title</p></body></html>';
      
      const result = crawler['extractArticleData'](htmlWithoutTitle, 'https://test.com/article');

      expect(result).toBeNull();
    });

    it('should return null for articles without content', () => {
      const htmlWithoutContent = '<html><body><h1 class="headline">Title Only</h1></body></html>';
      
      const result = crawler['extractArticleData'](htmlWithoutContent, 'https://test.com/article');

      expect(result).toBeNull();
    });

    it('should handle different content selectors', () => {
      const alternativeHtml = `
        <html>
          <body>
            <h1 class="story-headline">Alternative Layout</h1>
            <div class="article-content">
              <div class="text-long">
                <p>Content in alternative layout</p>
              </div>
            </div>
            <div class="article-publish-date">
              <time datetime="2024-02-01T12:00:00+08:00">February 1, 2024</time>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](alternativeHtml, 'https://test.com/article');

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Alternative Layout');
      expect(result?.content).toContain('alternative layout');
    });

    it('should extract publish date from various selectors', () => {
      const htmlWithDifferentDateFormat = `
        <html>
          <body>
            <h1 class="headline">Test Article</h1>
            <div class="story-info">
              <time datetime="2024-03-15T14:30:00+08:00">March 15, 2024</time>
            </div>
            <div class="story-body">
              <p>Test content</p>
            </div>
          </body>
        </html>
      `;

      const result = crawler['extractArticleData'](htmlWithDifferentDateFormat, 'https://test.com/article');

      expect(result?.publishDate).toBeInstanceOf(Date);
    });
  });

  describe('URL validation', () => {
    it('should accept valid article URLs', () => {
      const validUrls = [
        '/singapore/new-development-news',
        '/business/property-market-update',
        '/asia/regional-infrastructure-project'
      ];

      validUrls.forEach(url => {
        const isValid = crawler['isValidArticleUrl'](url);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid article URLs', () => {
      const invalidUrls = [
        '/videos/entertainment-show',
        '/photos/celebrity-gallery',
        '/multimedia/interactive-content',
        '/live-blog/sports-updates',
        '/opinion/letters/reader-feedback'
      ];

      invalidUrls.forEach(url => {
        const isValid = crawler['isValidArticleUrl'](url);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('date filtering', () => {
    it('should accept recent articles', () => {
      const recentDate = new Date('2024-01-15');
      const fromDate = new Date('2024-01-01');
      
      const isRecent = crawler['isRecentArticle'](recentDate, fromDate);
      
      expect(isRecent).toBe(true);
    });

    it('should reject old articles', () => {
      const oldDate = new Date('2023-12-15');
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
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result).toEqual([]);
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><div>Incomplete HTML';
      
      mockMakeRequest
        .mockResolvedValueOnce(mockSearchHtml)
        .mockResolvedValueOnce(malformedHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      expect(result).toEqual([]);
    });

    it('should continue processing other queries when one fails', async () => {
      mockMakeRequest
        .mockRejectedValueOnce(new Error('First query failed'))
        .mockResolvedValueOnce(mockSearchHtml) // Second query succeeds
        .mockResolvedValueOnce(mockArticleHtml);

      const fromDate = new Date('2024-01-01');
      const result = await crawler.searchArticles('Orchard', 'Orchard', fromDate);

      // Should still get results from successful queries
      expect(mockMakeRequest).toHaveBeenCalledTimes(3); // 2 searches + 1 article
    });
  });
});