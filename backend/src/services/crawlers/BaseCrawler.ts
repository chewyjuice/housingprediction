import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';

export interface CrawlerConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: number; // milliseconds between requests
}

export interface ArticleData {
  title: string;
  content: string;
  url: string;
  publishDate: Date;
  source: string;
}

export abstract class BaseCrawler {
  protected axiosInstance: AxiosInstance;
  protected config: CrawlerConfig;
  private lastRequestTime: number = 0;

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  }

  protected async makeRequest(url: string, options?: AxiosRequestConfig): Promise<string> {
    await this.enforceRateLimit();
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await this.axiosInstance.get(url, options);
        return response.data;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed for ${url}:`, error);
        
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }
    
    throw new Error(`Failed to fetch ${url} after ${this.config.retryAttempts} attempts: ${lastError?.message}`);
  }

  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.config.rateLimit) {
      const waitTime = this.config.rateLimit - timeSinceLastRequest;
      await this.delay(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected parseDate(dateString: string): Date {
    // Try common date formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Fallback to current date if parsing fails
    console.warn(`Could not parse date: ${dateString}, using current date`);
    return new Date();
  }

  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  // Abstract methods to be implemented by specific crawlers
  abstract searchArticles(query: string, areaName: string, fromDate: Date): Promise<ArticleData[]>;
  protected abstract extractArticleData(html: string, url: string): ArticleData | null;
}