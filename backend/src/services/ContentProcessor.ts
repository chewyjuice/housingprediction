import { ArticleData, ProcessedArticle } from '../types';
import { DevelopmentCategorizationEngine } from './DevelopmentCategorizationEngine';

export class ContentProcessor {
  private categorizationEngine: DevelopmentCategorizationEngine;

  constructor() {
    this.categorizationEngine = new DevelopmentCategorizationEngine();
  }

  private developmentKeywords = {
    school: [
      'school', 'education', 'primary school', 'secondary school', 'junior college',
      'university', 'polytechnic', 'institute', 'academy', 'campus', 'educational',
      'student', 'learning', 'curriculum', 'moe', 'ministry of education'
    ],
    infrastructure: [
      'mrt', 'lrt', 'train', 'station', 'transport', 'road', 'highway', 'bridge',
      'tunnel', 'infrastructure', 'construction', 'development', 'upgrade',
      'renovation', 'expansion', 'connectivity', 'accessibility', 'public transport'
    ],
    shopping: [
      'mall', 'shopping', 'retail', 'store', 'outlet', 'plaza', 'centre', 'center',
      'supermarket', 'hypermarket', 'department store', 'boutique', 'shop',
      'commercial', 'marketplace', 'bazaar', 'food court', 'restaurant'
    ],
    business: [
      'office', 'business', 'corporate', 'headquarters', 'hq', 'commercial',
      'tower', 'building', 'complex', 'park', 'hub', 'center', 'centre',
      'workspace', 'coworking', 'enterprise', 'company', 'firm', 'organization'
    ]
  };

  private locationKeywords = [
    // Singapore districts and areas
    'singapore', 'orchard', 'marina bay', 'raffles place', 'tanjong pagar',
    'chinatown', 'little india', 'bugis', 'clarke quay', 'sentosa',
    'jurong', 'tampines', 'bedok', 'pasir ris', 'woodlands', 'yishun',
    'ang mo kio', 'bishan', 'toa payoh', 'novena', 'newton', 'bukit timah',
    'holland village', 'clementi', 'queenstown', 'tiong bahru', 'katong',
    'east coast', 'changi', 'sengkang', 'punggol', 'hougang', 'serangoon'
  ];

  /**
   * Clean and normalize text content
   */
  public cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
      .trim();
  }

  /**
   * Filter articles based on development-related keywords
   */
  public filterDevelopmentContent(articles: ArticleData[]): ArticleData[] {
    return articles.filter(article => {
      const content = (article.title + ' ' + article.content).toLowerCase();
      
      // Check if article contains development-related keywords
      const allKeywords = [
        ...this.developmentKeywords.school,
        ...this.developmentKeywords.infrastructure,
        ...this.developmentKeywords.shopping,
        ...this.developmentKeywords.business,
        'development', 'project', 'construction', 'new', 'launch', 'opening'
      ];

      return allKeywords.some(keyword => content.includes(keyword));
    });
  }

  /**
   * Remove duplicate articles based on content similarity
   */
  public deduplicateArticles(articles: ArticleData[]): ArticleData[] {
    const uniqueArticles: ArticleData[] = [];
    const seenUrls = new Set<string>();
    
    for (const article of articles) {
      // Skip if we've seen this URL before
      if (seenUrls.has(article.url)) {
        continue;
      }
      
      // Check for content similarity with existing articles
      const isDuplicate = uniqueArticles.some(existing => 
        this.calculateSimilarity(article.title, existing.title) > 0.8 ||
        this.calculateSimilarity(article.content.substring(0, 200), existing.content.substring(0, 200)) > 0.7
      );
      
      if (!isDuplicate) {
        uniqueArticles.push(article);
        seenUrls.add(article.url);
      }
    }
    
    return uniqueArticles;
  }

  /**
   * Filter articles by date range (last 12 months)
   */
  public filterByDateRange(articles: ArticleData[], fromDate: Date): ArticleData[] {
    return articles.filter(article => article.publishDate >= fromDate);
  }

  /**
   * Process articles to extract structured information
   */
  public processArticles(articles: ArticleData[]): ProcessedArticle[] {
    return articles.map(article => this.processArticle(article));
  }

  private processArticle(article: ArticleData): ProcessedArticle {
    const cleanedContent = this.cleanText(article.content);
    const cleanedTitle = this.cleanText(article.title);
    const fullText = (cleanedTitle + ' ' + cleanedContent).toLowerCase();

    // Create processed article with basic data
    const processedArticle: ProcessedArticle = {
      ...article,
      title: cleanedTitle,
      content: cleanedContent,
      keywords: this.extractKeywords(fullText),
      developmentType: this.categorizeDevelopment(fullText),
      relevanceScore: this.calculateRelevanceScore(fullText),
      extractedEntities: this.extractEntities(fullText)
    };

    // Use categorization engine for enhanced classification
    const classification = this.categorizationEngine.classifyDevelopmentType(processedArticle);
    const entities = this.categorizationEngine.extractEntities(processedArticle);

    // Update with enhanced data
    processedArticle.developmentType = classification.type;
    processedArticle.keywords = [...processedArticle.keywords, ...classification.keywords];
    processedArticle.extractedEntities = {
      locations: [...processedArticle.extractedEntities.locations, ...entities.locations],
      organizations: [...processedArticle.extractedEntities.organizations, ...entities.organizations],
      projects: [...processedArticle.extractedEntities.projects, ...entities.projectNames]
    };

    // Remove duplicates
    processedArticle.keywords = Array.from(new Set(processedArticle.keywords));
    processedArticle.extractedEntities.locations = Array.from(new Set(processedArticle.extractedEntities.locations));
    processedArticle.extractedEntities.organizations = Array.from(new Set(processedArticle.extractedEntities.organizations));
    processedArticle.extractedEntities.projects = Array.from(new Set(processedArticle.extractedEntities.projects));

    return processedArticle;
  }

  private extractKeywords(text: string): string[] {
    const words = text.split(/\s+/);
    const keywords: string[] = [];
    
    // Extract development-related keywords
    const allKeywords = [
      ...this.developmentKeywords.school,
      ...this.developmentKeywords.infrastructure,
      ...this.developmentKeywords.shopping,
      ...this.developmentKeywords.business
    ];

    for (const keyword of allKeywords) {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return Array.from(new Set(keywords)); // Remove duplicates
  }

  private categorizeDevelopment(text: string): ProcessedArticle['developmentType'] {
    const scores = {
      school: this.calculateCategoryScore(text, this.developmentKeywords.school),
      infrastructure: this.calculateCategoryScore(text, this.developmentKeywords.infrastructure),
      shopping: this.calculateCategoryScore(text, this.developmentKeywords.shopping),
      business: this.calculateCategoryScore(text, this.developmentKeywords.business)
    };

    const maxScore = Math.max(...Object.values(scores));
    
    if (maxScore === 0) {
      return 'unknown';
    }

    // Check if multiple categories have high scores (mixed development)
    const highScoreCategories = Object.entries(scores).filter(([_, score]) => score >= maxScore * 0.8);
    
    if (highScoreCategories.length > 1) {
      return 'mixed';
    }

    return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as ProcessedArticle['developmentType'] || 'unknown';
  }

  private calculateCategoryScore(text: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    return score;
  }

  private calculateRelevanceScore(text: string): number {
    let score = 0;
    
    // Higher score for development-related terms
    const developmentTerms = ['development', 'project', 'construction', 'new', 'launch', 'opening', 'completion'];
    for (const term of developmentTerms) {
      if (text.includes(term)) {
        score += 2;
      }
    }
    
    // Higher score for location mentions
    for (const location of this.locationKeywords) {
      if (text.includes(location)) {
        score += 3;
      }
    }
    
    // Higher score for specific project details
    if (text.includes('million') || text.includes('billion')) {
      score += 1;
    }
    
    if (text.includes('2024') || text.includes('2025') || text.includes('2026')) {
      score += 1;
    }
    
    return Math.min(score, 10); // Cap at 10
  }

  private extractEntities(text: string): ProcessedArticle['extractedEntities'] {
    const entities = {
      locations: [] as string[],
      organizations: [] as string[],
      projects: [] as string[]
    };

    // Extract locations
    for (const location of this.locationKeywords) {
      if (text.includes(location)) {
        entities.locations.push(location);
      }
    }

    // Extract organizations (simple pattern matching)
    const orgPatterns = [
      /\b[A-Z][a-z]+ (?:Pte Ltd|Ltd|Corporation|Corp|Company|Co|Group|Holdings|Development|Developments)\b/g,
      /\b(?:Ministry of|MOE|HDB|URA|LTA|JTC|Capitaland|City Developments|Far East Organization)\b/gi
    ];

    for (const pattern of orgPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.organizations.push(...matches);
      }
    }

    // Extract project names (capitalized phrases)
    const projectPattern = /\b[A-Z][a-z]+(?: [A-Z][a-z]+){1,3}(?: (?:Mall|Centre|Center|Tower|Building|Complex|Park|Station|School|Hospital))\b/g;
    const projectMatches = text.match(projectPattern);
    if (projectMatches) {
      entities.projects.push(...projectMatches);
    }

    // Remove duplicates and clean up
    entities.locations = Array.from(new Set(entities.locations));
    entities.organizations = Array.from(new Set(entities.organizations));
    entities.projects = Array.from(new Set(entities.projects));

    return entities;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);
    
    return intersection.size / union.size;
  }
}