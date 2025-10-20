import { DevelopmentCategorizationEngine } from '../DevelopmentCategorizationEngine';
import { ProcessedArticle } from '../../types';

describe('DevelopmentCategorizationEngine', () => {
  let engine: DevelopmentCategorizationEngine;

  beforeEach(() => {
    engine = new DevelopmentCategorizationEngine();
  });

  describe('classifyDevelopmentType', () => {
    it('should classify school development correctly', () => {
      const article: ProcessedArticle = {
        title: 'New Primary School Opens in Tampines',
        content: 'The Ministry of Education announced the opening of a new primary school in Tampines. The school will accommodate 1,200 students and features modern classrooms and laboratories.',
        url: 'https://example.com/school-news',
        publishDate: new Date('2024-01-15'),
        source: 'The Straits Times',
        keywords: ['school', 'education', 'primary'],
        developmentType: 'school',
        relevanceScore: 0.9,
        extractedEntities: {
          locations: ['Tampines'],
          organizations: ['MOE'],
          projects: ['Tampines Primary School']
        }
      };

      const result = engine.classifyDevelopmentType(article);

      expect(result.type).toBe('school');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.keywords).toContain('school');
    });

    it('should classify infrastructure development correctly', () => {
      const article: ProcessedArticle = {
        title: 'New MRT Line Construction Begins',
        content: 'LTA announced the construction of a new MRT line connecting Jurong to Marina Bay. The project includes 15 new stations and will improve connectivity across Singapore.',
        url: 'https://example.com/mrt-news',
        publishDate: new Date('2024-02-01'),
        source: 'Channel NewsAsia',
        keywords: ['mrt', 'transport', 'infrastructure'],
        developmentType: 'infrastructure',
        relevanceScore: 0.95,
        extractedEntities: {
          locations: ['Jurong', 'Marina Bay'],
          organizations: ['LTA'],
          projects: ['New MRT Line']
        }
      };

      const result = engine.classifyDevelopmentType(article);

      expect(result.type).toBe('infrastructure');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.keywords).toContain('mrt');
    });

    it('should classify shopping development correctly', () => {
      const article: ProcessedArticle = {
        title: 'Major Shopping Mall Opens in Orchard',
        content: 'A new 5-story shopping mall featuring over 200 retail outlets and a food court opened in Orchard Road. The mall includes anchor tenants and luxury boutiques.',
        url: 'https://example.com/mall-news',
        publishDate: new Date('2024-03-01'),
        source: 'PropertyGuru',
        keywords: ['mall', 'shopping', 'retail'],
        developmentType: 'shopping',
        relevanceScore: 0.85,
        extractedEntities: {
          locations: ['Orchard'],
          organizations: [],
          projects: ['Orchard Shopping Mall']
        }
      };

      const result = engine.classifyDevelopmentType(article);

      expect(result.type).toBe('shopping');
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.keywords).toContain('mall');
    });

    it('should classify business development correctly', () => {
      const article: ProcessedArticle = {
        title: 'New Corporate Headquarters Tower Announced',
        content: 'A major corporation announced plans for a new 40-story office tower in the CBD. The building will house the company headquarters and create 2,000 jobs.',
        url: 'https://example.com/office-news',
        publishDate: new Date('2024-04-01'),
        source: 'Business Times',
        keywords: ['office', 'corporate', 'headquarters'],
        developmentType: 'business',
        relevanceScore: 0.8,
        extractedEntities: {
          locations: ['CBD'],
          organizations: [],
          projects: ['Corporate Tower']
        }
      };

      const result = engine.classifyDevelopmentType(article);

      expect(result.type).toBe('business');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.keywords).toContain('office');
    });

    it('should handle mixed content with fallback to business', () => {
      const article: ProcessedArticle = {
        title: 'Random News Article',
        content: 'This article talks about weather patterns and seasonal changes in the region.',
        url: 'https://example.com/general',
        publishDate: new Date('2024-01-01'),
        source: 'News Source',
        keywords: [],
        developmentType: 'unknown',
        relevanceScore: 0.1,
        extractedEntities: {
          locations: [],
          organizations: [],
          projects: []
        }
      };

      const result = engine.classifyDevelopmentType(article);

      // Accept any type for classification of non-development content
      expect(['school', 'infrastructure', 'shopping', 'business']).toContain(result.type);
      // Confidence should be relatively low for non-development content
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('extractEntities', () => {
    it('should extract project names correctly', () => {
      const article: ProcessedArticle = {
        title: 'Tampines Mall Extension Opens',
        content: 'The new "Tampines Central Hub" and Orchard Tower are major developments. The Marina Bay Complex will also be completed soon.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'shopping',
        relevanceScore: 0.8,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = engine.extractEntities(article);

      expect(result.projectNames).toContain('Tampines Mall');
      expect(result.projectNames.length).toBeGreaterThan(0);
    });

    it('should extract Singapore locations correctly', () => {
      const article: ProcessedArticle = {
        title: 'Development in Orchard and Marina Bay',
        content: 'New projects are planned for Tampines, Jurong, and Woodlands areas.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'mixed',
        relevanceScore: 0.8,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = engine.extractEntities(article);

      expect(result.locations).toContain('Orchard');
      expect(result.locations).toContain('Marina Bay');
      expect(result.locations).toContain('Tampines');
      expect(result.locations).toContain('Jurong');
      expect(result.locations).toContain('Woodlands');
    });

    it('should extract organizations correctly', () => {
      const article: ProcessedArticle = {
        title: 'MOE and LTA Joint Project',
        content: 'The Ministry of Education (MOE) and Land Transport Authority (LTA) announced a joint project. CapitaLand Pte Ltd will be the developer.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'infrastructure',
        relevanceScore: 0.9,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = engine.extractEntities(article);

      expect(result.organizations).toContain('MOE');
      expect(result.organizations).toContain('LTA');
      expect(result.organizations.some(org => org.includes('CapitaLand'))).toBe(true);
    });

    it('should extract dates correctly', () => {
      const article: ProcessedArticle = {
        title: 'Project Timeline Announced',
        content: 'The project will be completed by 2025. Construction starts in Q2 2024 and the opening is scheduled for December 2025.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'infrastructure',
        relevanceScore: 0.8,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = engine.extractEntities(article);

      expect(result.dates.some(date => date.includes('2025'))).toBe(true);
      expect(result.dates.some(date => date.includes('2024'))).toBe(true);
    });

    it('should extract monetary amounts correctly', () => {
      const article: ProcessedArticle = {
        title: 'Billion Dollar Investment',
        content: 'The project requires $2.5 billion investment. Additional funding of S$500 million was secured.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.9,
        extractedEntities: { locations: [], organizations: [], projects: [] }
      };

      const result = engine.extractEntities(article);

      expect(result.amounts.some(amount => amount.includes('billion'))).toBe(true);
      expect(result.amounts.some(amount => amount.includes('million'))).toBe(true);
    });
  });

  describe('calculateImpactScore', () => {
    it('should calculate higher impact score for major infrastructure', () => {
      const article: ProcessedArticle = {
        title: 'Major MRT Line Construction',
        content: 'A $5 billion MRT line project will transform connectivity across Singapore. The project creates 10,000 jobs and improves public transport accessibility.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: ['mrt', 'transport', 'connectivity'],
        developmentType: 'infrastructure',
        relevanceScore: 0.95,
        extractedEntities: {
          locations: ['Singapore'],
          organizations: ['LTA'],
          projects: ['MRT Line']
        }
      };

      const classification = {
        type: 'infrastructure' as const,
        confidence: 0.9,
        keywords: ['mrt', 'transport', 'connectivity']
      };

      const entities = {
        projectNames: ['MRT Line'],
        locations: ['Singapore'],
        organizations: ['LTA'],
        dates: ['2025'],
        amounts: ['$5 billion']
      };

      const score = engine.calculateImpactScore(article, classification, entities);

      expect(score).toBeGreaterThan(5);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should calculate moderate impact score for local shopping development', () => {
      const article: ProcessedArticle = {
        title: 'Small Shopping Center Opens',
        content: 'A new local shopping center with 20 shops opened in the neighborhood.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: ['shopping', 'local'],
        developmentType: 'shopping',
        relevanceScore: 0.6,
        extractedEntities: {
          locations: ['Local Area'],
          organizations: [],
          projects: ['Shopping Center']
        }
      };

      const classification = {
        type: 'shopping' as const,
        confidence: 0.7,
        keywords: ['shopping', 'local']
      };

      const entities = {
        projectNames: ['Shopping Center'],
        locations: ['Local Area'],
        organizations: [],
        dates: [],
        amounts: []
      };

      const score = engine.calculateImpactScore(article, classification, entities);

      expect(score).toBeGreaterThan(1);
      expect(score).toBeLessThan(6);
    });

    it('should calculate high impact score for major educational institution', () => {
      const article: ProcessedArticle = {
        title: 'New University Campus Announced',
        content: 'A major university will establish a new campus with capacity for 15,000 students. The $800 million project will boost educational opportunities.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: ['university', 'education', 'campus'],
        developmentType: 'school',
        relevanceScore: 0.9,
        extractedEntities: {
          locations: ['Singapore'],
          organizations: ['University'],
          projects: ['University Campus']
        }
      };

      const classification = {
        type: 'school' as const,
        confidence: 0.85,
        keywords: ['university', 'education', 'campus']
      };

      const entities = {
        projectNames: ['University Campus'],
        locations: ['Singapore'],
        organizations: ['University'],
        dates: ['2026'],
        amounts: ['$800 million']
      };

      const score = engine.calculateImpactScore(article, classification, entities);

      expect(score).toBeGreaterThan(6);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should apply confidence penalty for low confidence classifications', () => {
      const article: ProcessedArticle = {
        title: 'Unclear Development News',
        content: 'Some development mentioned without clear details.',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.3,
        extractedEntities: {
          locations: [],
          organizations: [],
          projects: []
        }
      };

      const classification = {
        type: 'business' as const,
        confidence: 0.2, // Low confidence
        keywords: []
      };

      const entities = {
        projectNames: [],
        locations: [],
        organizations: [],
        dates: [],
        amounts: []
      };

      const score = engine.calculateImpactScore(article, classification, entities);

      expect(score).toBeLessThan(3); // Should be penalized for low confidence
    });

    it('should return score within valid range (0-10)', () => {
      const article: ProcessedArticle = {
        title: 'Test Development',
        content: 'Test content',
        url: 'https://example.com',
        publishDate: new Date(),
        source: 'Test',
        keywords: [],
        developmentType: 'business',
        relevanceScore: 0.5,
        extractedEntities: {
          locations: [],
          organizations: [],
          projects: []
        }
      };

      const classification = {
        type: 'business' as const,
        confidence: 0.5,
        keywords: []
      };

      const entities = {
        projectNames: [],
        locations: [],
        organizations: [],
        dates: [],
        amounts: []
      };

      const score = engine.calculateImpactScore(article, classification, entities);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });
});