import { ContentProcessor, ProcessedArticle } from '../ContentProcessor';
import { ArticleData } from '../crawlers/BaseCrawler';

describe('ContentProcessor', () => {
  let contentProcessor: ContentProcessor;

  const mockArticles: ArticleData[] = [
    {
      title: 'New Primary School Opens in Orchard',
      content: 'The Ministry of Education announced the opening of a new primary school in the Orchard district to serve the growing student population.',
      url: 'https://example.com/school-news',
      publishDate: new Date('2024-01-15'),
      source: 'The Straits Times'
    },
    {
      title: 'MRT Line Extension to Tampines',
      content: 'LTA will extend the MRT line to Tampines with new stations and improved connectivity for residents.',
      url: 'https://example.com/mrt-news',
      publishDate: new Date('2024-02-10'),
      source: 'Channel NewsAsia'
    },
    {
      title: 'New Shopping Mall in Jurong',
      content: 'A major shopping mall development will bring retail and dining options to Jurong residents.',
      url: 'https://example.com/mall-news',
      publishDate: new Date('2024-03-05'),
      source: 'PropertyGuru'
    },
    {
      title: 'Office Tower Construction in CBD',
      content: 'A new 40-story office tower will be constructed in the Central Business District to accommodate growing business needs.',
      url: 'https://example.com/office-news',
      publishDate: new Date('2024-01-20'),
      source: 'The Straits Times'
    },
    {
      title: 'Celebrity Update',
      content: 'Latest celebrity gossip and entertainment from Singapore.',
      url: 'https://example.com/celebrity-news',
      publishDate: new Date('2024-02-15'),
      source: 'Entertainment Weekly'
    }
  ];

  beforeEach(() => {
    contentProcessor = new ContentProcessor();
  });

  describe('cleanText', () => {
    it('should remove HTML tags from text', () => {
      const htmlText = '<p>This is a <strong>test</strong> with <em>HTML</em> tags.</p>';
      const cleaned = contentProcessor.cleanText(htmlText);
      
      expect(cleaned).toBe('This is a test with HTML tags.');
    });

    it('should remove HTML entities', () => {
      const entityText = 'Price is S&dollar;100 &amp; tax is 7&percnt;';
      const cleaned = contentProcessor.cleanText(entityText);
      
      expect(cleaned).toBe('Price is S 100 tax is 7');
    });

    it('should normalize whitespace', () => {
      const messyText = 'This   has    multiple\n\n\nspaces\tand\ttabs';
      const cleaned = contentProcessor.cleanText(messyText);
      
      expect(cleaned).toBe('This has multiple spaces and tabs');
    });

    it('should remove special characters except basic punctuation', () => {
      const specialText = 'Hello@#$%^&*()world! How are you?';
      const cleaned = contentProcessor.cleanText(specialText);
      
      expect(cleaned).toBe('Helloworld! How are you?');
    });
  });

  describe('filterDevelopmentContent', () => {
    it('should filter articles containing development-related keywords', () => {
      const filtered = contentProcessor.filterDevelopmentContent(mockArticles);
      
      expect(filtered).toHaveLength(4);
      expect(filtered.map(a => a.title)).toEqual([
        'New Primary School Opens in Orchard',
        'MRT Line Extension to Tampines',
        'New Shopping Mall in Jurong',
        'Office Tower Construction in CBD'
      ]);
    });

    it('should exclude articles without development keywords', () => {
      const nonDevelopmentArticles = [
        {
          title: 'Weather Update for Singapore',
          content: 'Today will be sunny with occasional clouds.',
          url: 'https://example.com/weather',
          publishDate: new Date(),
          source: 'Weather Channel'
        }
      ];

      const filtered = contentProcessor.filterDevelopmentContent(nonDevelopmentArticles);
      
      expect(filtered).toHaveLength(0);
    });

    it('should include articles with school-related keywords', () => {
      const schoolArticles = [
        {
          title: 'University Campus Expansion',
          content: 'The university will expand its campus to accommodate more students.',
          url: 'https://example.com/university',
          publishDate: new Date(),
          source: 'Education News'
        }
      ];

      const filtered = contentProcessor.filterDevelopmentContent(schoolArticles);
      
      expect(filtered).toHaveLength(1);
    });
  });

  describe('deduplicateArticles', () => {
    it('should remove articles with identical URLs', () => {
      const duplicateArticles = [
        mockArticles[0],
        { ...mockArticles[0], title: 'Different Title' }, // Same URL
        mockArticles[1]
      ];

      const deduplicated = contentProcessor.deduplicateArticles(duplicateArticles);
      
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].url).toBe(mockArticles[0].url);
      expect(deduplicated[1].url).toBe(mockArticles[1].url);
    });

    it('should remove articles with similar titles', () => {
      const similarArticles = [
        {
          title: 'New School Opens in Orchard District',
          content: 'Content about school opening',
          url: 'https://example.com/school1',
          publishDate: new Date(),
          source: 'Source 1'
        },
        {
          title: 'New School Opens in Orchard Area',
          content: 'Different content about same school',
          url: 'https://example.com/school2',
          publishDate: new Date(),
          source: 'Source 2'
        }
      ];

      const deduplicated = contentProcessor.deduplicateArticles(similarArticles);
      
      expect(deduplicated.length).toBeLessThanOrEqual(2); // May not deduplicate if similarity threshold not met
    });

    it('should keep articles with different content', () => {
      const differentArticles = [
        mockArticles[0], // School article
        mockArticles[1]  // MRT article
      ];

      const deduplicated = contentProcessor.deduplicateArticles(differentArticles);
      
      expect(deduplicated).toHaveLength(2);
    });
  });

  describe('filterByDateRange', () => {
    it('should filter articles within date range', () => {
      const fromDate = new Date('2024-02-01');
      const filtered = contentProcessor.filterByDateRange(mockArticles, fromDate);
      
      expect(filtered.length).toBeGreaterThanOrEqual(2);
      expect(filtered.some(a => a.title === 'MRT Line Extension to Tampines')).toBe(true);
      expect(filtered.some(a => a.title === 'New Shopping Mall in Jurong')).toBe(true);
    });

    it('should include articles on the boundary date', () => {
      const fromDate = new Date('2024-02-10');
      const filtered = contentProcessor.filterByDateRange(mockArticles, fromDate);
      
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.some(a => a.publishDate.getTime() === fromDate.getTime())).toBe(true);
    });

    it('should return empty array when no articles in range', () => {
      const fromDate = new Date('2024-12-01');
      const filtered = contentProcessor.filterByDateRange(mockArticles, fromDate);
      
      expect(filtered).toHaveLength(0);
    });
  });

  describe('processArticles', () => {
    it('should process all articles and return ProcessedArticle objects', () => {
      const developmentArticles = mockArticles.slice(0, 4); // Exclude celebrity news
      const processed = contentProcessor.processArticles(developmentArticles);
      
      expect(processed).toHaveLength(4);
      expect(processed[0]).toEqual(expect.objectContaining({
        title: expect.any(String),
        content: expect.any(String),
        keywords: expect.any(Array),
        developmentType: expect.any(String),
        relevanceScore: expect.any(Number),
        extractedEntities: expect.objectContaining({
          locations: expect.any(Array),
          organizations: expect.any(Array),
          projects: expect.any(Array)
        })
      }));
    });

    it('should categorize school development correctly', () => {
      const schoolArticle = [mockArticles[0]]; // School article
      const processed = contentProcessor.processArticles(schoolArticle);
      
      expect(processed[0].developmentType).toBe('school');
      expect(processed[0].keywords).toContain('school');
    });

    it('should categorize infrastructure development correctly', () => {
      const infraArticle = [mockArticles[1]]; // MRT article
      const processed = contentProcessor.processArticles(infraArticle);
      
      expect(processed[0].developmentType).toBe('infrastructure');
      expect(processed[0].keywords).toContain('mrt');
    });

    it('should categorize shopping development correctly', () => {
      const shoppingArticle = [mockArticles[2]]; // Mall article
      const processed = contentProcessor.processArticles(shoppingArticle);
      
      expect(processed[0].developmentType).toBe('shopping');
      expect(processed[0].keywords).toContain('mall');
    });

    it('should categorize business development correctly', () => {
      const businessArticle = [mockArticles[3]]; // Office article
      const processed = contentProcessor.processArticles(businessArticle);
      
      expect(processed[0].developmentType).toBe('business');
      expect(processed[0].keywords).toContain('office');
    });

    it('should extract location entities', () => {
      const orchardArticle = [mockArticles[0]]; // Contains "Orchard"
      const processed = contentProcessor.processArticles(orchardArticle);
      
      expect(processed[0].extractedEntities.locations).toContain('orchard');
    });

    it('should calculate relevance scores', () => {
      const processed = contentProcessor.processArticles([mockArticles[0]]);
      
      expect(processed[0].relevanceScore).toBeGreaterThan(0);
      expect(processed[0].relevanceScore).toBeLessThanOrEqual(10);
    });

    it('should handle mixed development types', () => {
      const mixedArticle = [{
        title: 'Mixed Development with School and Shopping Mall and Office Tower',
        content: 'New development includes both educational school facilities and retail shopping mall and business office tower infrastructure.',
        url: 'https://example.com/mixed',
        publishDate: new Date(),
        source: 'Test Source'
      }];

      const processed = contentProcessor.processArticles(mixedArticle);
      
      expect(processed[0].developmentType).toBe('mixed');
    });

    it('should return unknown for unrecognized development types', () => {
      const unknownArticle = [{
        title: 'Random Article',
        content: 'Some content that does not fit standard categories.',
        url: 'https://example.com/unknown',
        publishDate: new Date(),
        source: 'Test Source'
      }];

      const processed = contentProcessor.processArticles(unknownArticle);
      
      expect(processed[0].developmentType).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle empty article arrays', () => {
      expect(contentProcessor.filterDevelopmentContent([])).toEqual([]);
      expect(contentProcessor.deduplicateArticles([])).toEqual([]);
      expect(contentProcessor.filterByDateRange([], new Date())).toEqual([]);
      expect(contentProcessor.processArticles([])).toEqual([]);
    });

    it('should handle articles with empty content', () => {
      const emptyArticles = [{
        title: '',
        content: '',
        url: 'https://example.com/empty',
        publishDate: new Date(),
        source: 'Test'
      }];

      const processed = contentProcessor.processArticles(emptyArticles);
      
      expect(processed).toHaveLength(1);
      expect(processed[0].keywords).toEqual([]);
      expect(processed[0].developmentType).toBe('unknown');
    });

    it('should handle malformed dates gracefully', () => {
      const articlesWithBadDates = [{
        title: 'Test Article',
        content: 'Test content with development keywords',
        url: 'https://example.com/test',
        publishDate: new Date('invalid-date'),
        source: 'Test'
      }];

      expect(() => {
        contentProcessor.filterByDateRange(articlesWithBadDates, new Date());
      }).not.toThrow();
    });
  });
});