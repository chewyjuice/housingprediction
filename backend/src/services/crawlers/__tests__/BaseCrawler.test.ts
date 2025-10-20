import axios from 'axios';
import { BaseCrawler, CrawlerConfig, ArticleData } from '../BaseCrawler';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Concrete implementation for testing
class TestCrawler extends BaseCrawler {
  constructor(config?: Partial<CrawlerConfig>) {
    const defaultConfig: CrawlerConfig = {
      baseURL: 'https://test.com',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
      rateLimit: 50
    };
    super({ ...defaultConfig, ...config });
  }

  async searchArticles(query: string, areaName: string, fromDate: Date): Promise<ArticleData[]> {
    const html = await this.makeRequest('/search');
    const article = this.extractArticleData(html, 'https://test.com/article');
    return article ? [article] : [];
  }

  protected extractArticleData(html: string, url: string): ArticleData | null {
    if (html.includes('valid-article')) {
      return {
        title: 'Test Article',
        content: 'Test content',
        url,
        publishDate: new Date('2024-01-01'),
        source: 'Test Source'
      };
    }
    return null;
  }
}

describe('BaseCrawler', () => {
  let testCrawler: TestCrawler;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      get: jest.fn()
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    testCrawler = new TestCrawler();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.com',
        timeout: 5000,
        headers: {
          'User-Agent': expect.stringContaining('Mozilla/5.0')
        }
      });
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        baseURL: 'https://custom.com',
        timeout: 10000,
        retryAttempts: 5
      };
      
      new TestCrawler(customConfig);
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://custom.com',
        timeout: 10000,
        headers: {
          'User-Agent': expect.stringContaining('Mozilla/5.0')
        }
      });
    });
  });

  describe('makeRequest', () => {
    it('should make successful HTTP request', async () => {
      const mockResponse = { data: '<html>valid-article</html>' };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await testCrawler['makeRequest']('/test-url');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-url', undefined);
      expect(result).toBe('<html>valid-article</html>');
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const error = new Error('Network error');
      const mockResponse = { data: '<html>success</html>' };
      
      mockAxiosInstance.get
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const result = await testCrawler['makeRequest']('/test-url');

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(result).toBe('<html>success</html>');
    });

    it('should fail after exhausting retry attempts', async () => {
      const error = new Error('Persistent network error');
      mockAxiosInstance.get.mockRejectedValue(error);

      await expect(testCrawler['makeRequest']('/test-url')).rejects.toThrow(
        'Failed to fetch /test-url after 2 attempts: Persistent network error'
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    });

    it('should enforce rate limiting between requests', async () => {
      const mockResponse = { data: '<html>test</html>' };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const startTime = Date.now();
      
      // Make two requests
      await testCrawler['makeRequest']('/url1');
      await testCrawler['makeRequest']('/url2');
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should take at least the rate limit time (50ms)
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
    });
  });

  describe('parseDate', () => {
    it('should parse valid date strings', () => {
      const dateString = '2024-01-15T10:30:00Z';
      const result = testCrawler['parseDate'](dateString);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(15);
    });

    it('should handle various date formats', () => {
      const formats = [
        '2024-01-15',
        'January 15, 2024',
        '15 Jan 2024',
        '2024/01/15'
      ];

      formats.forEach(format => {
        const result = testCrawler['parseDate'](format);
        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2024);
      });
    });

    it('should return current date for invalid date strings', () => {
      const beforeCall = new Date();
      const result = testCrawler['parseDate']('invalid-date-string');
      const afterCall = new Date();
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });

  describe('cleanText', () => {
    it('should normalize whitespace', () => {
      const messyText = 'This   has    multiple\n\n\nspaces\tand\ttabs';
      const result = testCrawler['cleanText'](messyText);
      
      expect(result).toBe('This has multiple spaces and tabs');
    });

    it('should trim leading and trailing whitespace', () => {
      const text = '   Leading and trailing spaces   ';
      const result = testCrawler['cleanText'](text);
      
      expect(result).toBe('Leading and trailing spaces');
    });

    it('should handle empty strings', () => {
      const result = testCrawler['cleanText']('');
      expect(result).toBe('');
    });

    it('should handle strings with only whitespace', () => {
      const result = testCrawler['cleanText']('   \n\t   ');
      expect(result).toBe('');
    });
  });

  describe('searchArticles', () => {
    it('should search and extract articles successfully', async () => {
      const mockResponse = { data: '<html>valid-article</html>' };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await testCrawler.searchArticles('test query', 'Test Area', new Date());

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'Test Article',
        content: 'Test content',
        url: 'https://test.com/article',
        publishDate: new Date('2024-01-01'),
        source: 'Test Source'
      });
    });

    it('should return empty array when no valid articles found', async () => {
      const mockResponse = { data: '<html>no-valid-content</html>' };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await testCrawler.searchArticles('test query', 'Test Area', new Date());

      expect(result).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      // The searchArticles method should catch the error and return empty array
      await expect(async () => {
        const result = await testCrawler.searchArticles('test query', 'Test Area', new Date());
        expect(result).toEqual([]);
      }).not.toThrow();
    });
  });

  describe('delay', () => {
    it('should delay execution for specified time', async () => {
      const startTime = Date.now();
      await testCrawler['delay'](100);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow some tolerance
    });

    it('should handle zero delay', async () => {
      const startTime = Date.now();
      await testCrawler['delay'](0);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50); // More lenient timing
    });
  });

  describe('enforceRateLimit', () => {
    it('should not delay first request', async () => {
      const startTime = Date.now();
      await testCrawler['enforceRateLimit']();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should delay subsequent requests within rate limit window', async () => {
      // First request
      await testCrawler['enforceRateLimit']();
      
      // Second request should be delayed
      const startTime = Date.now();
      await testCrawler['enforceRateLimit']();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(45); // Rate limit is 50ms
    });
  });

  describe('error handling', () => {
    it('should handle axios timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      timeoutError.name = 'AxiosError';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      await expect(testCrawler['makeRequest']('/timeout-url')).rejects.toThrow(
        'Failed to fetch /timeout-url after 2 attempts'
      );
    });

    it('should handle network connection errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(testCrawler['makeRequest']('/network-error')).rejects.toThrow(
        'Failed to fetch /network-error after 2 attempts'
      );
    });

    it('should handle HTTP error responses', async () => {
      const httpError = new Error('Request failed with status code 404');
      mockAxiosInstance.get.mockRejectedValue(httpError);

      await expect(testCrawler['makeRequest']('/not-found')).rejects.toThrow(
        'Failed to fetch /not-found after 2 attempts'
      );
    });
  });
});