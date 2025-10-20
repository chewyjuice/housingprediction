import { ProcessedArticle, DevelopmentEntity, ServiceResponse } from '../types';
import { DevelopmentCategorizationEngine, EntityExtractionResult, DevelopmentClassification } from './DevelopmentCategorizationEngine';
import { IDevelopmentRepository } from '../repositories/DevelopmentRepository';
import { IAreaRepository } from '../repositories/AreaRepository';

export interface ProcessingResult {
  processedCount: number;
  createdDevelopments: DevelopmentEntity[];
  skippedCount: number;
  errors: string[];
  processingTime: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LocationRelevanceResult {
  isRelevant: boolean;
  matchedLocations: string[];
  confidence: number;
}

export class DataProcessingPipeline {
  private categorizationEngine: DevelopmentCategorizationEngine;
  private developmentRepository: IDevelopmentRepository;
  private areaRepository: IAreaRepository;

  constructor(
    developmentRepository: IDevelopmentRepository,
    areaRepository: IAreaRepository
  ) {
    this.categorizationEngine = new DevelopmentCategorizationEngine();
    this.developmentRepository = developmentRepository;
    this.areaRepository = areaRepository;
  }

  /**
   * Main processing pipeline that consumes crawler output
   */
  public async processArticles(
    articles: ProcessedArticle[],
    areaId: string
  ): Promise<ServiceResponse<ProcessingResult>> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      processedCount: 0,
      createdDevelopments: [],
      skippedCount: 0,
      errors: [],
      processingTime: 0
    };

    try {
      // Validate area exists
      const area = await this.areaRepository.findById(areaId);
      if (!area) {
        return {
          success: false,
          error: `Area with ID ${areaId} not found`
        };
      }

      for (const article of articles) {
        try {
          // Step 1: Validate article data
          const validation = this.validateArticleData(article);
          if (!validation.isValid) {
            result.errors.push(`Article validation failed: ${validation.errors.join(', ')}`);
            result.skippedCount++;
            continue;
          }

          // Step 2: Verify location relevance
          const relevance = await this.verifyLocationRelevance(article, area.name, area.district);
          if (!relevance.isRelevant) {
            result.skippedCount++;
            continue;
          }

          // Step 3: Check for duplicates
          const isDuplicate = await this.checkForDuplicates(article, areaId);
          if (isDuplicate) {
            result.skippedCount++;
            continue;
          }

          // Step 4: Process article into development
          const development = await this.transformArticleToDevelopment(article, areaId);
          if (development) {
            result.createdDevelopments.push(development);
            result.processedCount++;
          } else {
            result.skippedCount++;
          }

        } catch (error) {
          result.errors.push(`Error processing article "${article.title}": ${error}`);
          result.skippedCount++;
        }
      }

      result.processingTime = Date.now() - startTime;

      return {
        success: true,
        data: result
      };

    } catch (error) {
      return {
        success: false,
        error: `Pipeline processing failed: ${error}`
      };
    }
  }  /**

   * Validate article data quality
   */
  public validateArticleData(article: ProcessedArticle): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!article.title || article.title.trim().length === 0) {
      errors.push('Article title is required');
    }

    if (!article.content || article.content.trim().length < 50) {
      errors.push('Article content is too short (minimum 50 characters)');
    }

    if (!article.url || !this.isValidUrl(article.url)) {
      errors.push('Valid article URL is required');
    }

    if (!article.publishDate || isNaN(article.publishDate.getTime())) {
      errors.push('Valid publish date is required');
    }

    if (!article.source || article.source.trim().length === 0) {
      errors.push('Article source is required');
    }

    // Quality checks
    if (article.title.length > 200) {
      warnings.push('Article title is unusually long');
    }

    if (article.content.length > 10000) {
      warnings.push('Article content is very long');
    }

    // Date validation
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const futureDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    if (article.publishDate < oneYearAgo) {
      warnings.push('Article is older than one year');
    }

    if (article.publishDate > futureDate) {
      errors.push('Article publish date is in the future');
    }

    // Relevance score validation
    if (article.relevanceScore < 1) {
      warnings.push('Article has low relevance score');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Verify location relevance for extracted developments
   */
  public async verifyLocationRelevance(
    article: ProcessedArticle,
    areaName: string,
    district: string
  ): Promise<LocationRelevanceResult> {
    const text = (article.title + ' ' + article.content).toLowerCase();
    const areaNameLower = areaName.toLowerCase();
    const districtLower = district.toLowerCase();

    const matchedLocations: string[] = [];
    let confidence = 0;

    // Direct area name match
    if (text.includes(areaNameLower)) {
      matchedLocations.push(areaName);
      confidence += 0.4;
    }

    // District name match
    if (text.includes(districtLower)) {
      matchedLocations.push(district);
      confidence += 0.3;
    }

    // Check extracted entities
    if (article.extractedEntities?.locations) {
      for (const location of article.extractedEntities.locations) {
        const locationLower = location.toLowerCase();
        if (locationLower.includes(areaNameLower) || areaNameLower.includes(locationLower)) {
          matchedLocations.push(location);
          confidence += 0.2;
        }
        if (locationLower.includes(districtLower) || districtLower.includes(locationLower)) {
          matchedLocations.push(location);
          confidence += 0.1;
        }
      }
    }

    // Nearby location indicators
    const nearbyKeywords = ['nearby', 'adjacent', 'close to', 'near', 'vicinity', 'surrounding'];
    for (const keyword of nearbyKeywords) {
      if (text.includes(keyword)) {
        confidence += 0.05;
        break;
      }
    }

    return {
      isRelevant: confidence >= 0.2, // Minimum 20% confidence required
      matchedLocations: Array.from(new Set(matchedLocations)),
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Check for duplicate developments
   */
  private async checkForDuplicates(article: ProcessedArticle, areaId: string): Promise<boolean> {
    try {
      const existingDevelopments = await this.developmentRepository.findDuplicateDevelopments(
        areaId,
        article.title,
        article.url
      );

      return existingDevelopments.length > 0;
    } catch (error) {
      console.warn('Error checking for duplicates:', error);
      return false; // Continue processing if duplicate check fails
    }
  }

  /**
   * Transform processed article to Development entity
   */
  private async transformArticleToDevelopment(
    article: ProcessedArticle,
    areaId: string
  ): Promise<DevelopmentEntity | null> {
    try {
      // Classify development type
      const classification = this.categorizationEngine.classifyDevelopmentType(article);
      
      // Skip if classification confidence is too low
      if (classification.confidence < 0.3) {
        return null;
      }

      // Extract entities
      const entities = this.categorizationEngine.extractEntities(article);

      // Calculate impact score
      const impactScore = this.categorizationEngine.calculateImpactScore(
        article,
        classification,
        entities
      );

      // Extract project name (use first extracted project name or fallback to title)
      const projectName = entities.projectNames.length > 0 
        ? entities.projectNames[0] 
        : this.extractProjectNameFromTitle(article.title);

      // Extract dates
      const dateAnnounced = this.extractAnnouncementDate(article, entities);
      const expectedCompletion = this.extractCompletionDate(article, entities);

      // Create development entity
      const developmentData = {
        areaId,
        type: classification.type,
        title: projectName,
        description: this.generateDescription(article, classification, entities),
        impactScore,
        dateAnnounced,
        expectedCompletion,
        sourceUrl: article.url,
        sourcePublisher: article.source,
        sourcePublishDate: article.publishDate
      };

      return await this.developmentRepository.create(developmentData);

    } catch (error) {
      console.error('Error transforming article to development:', error);
      return null;
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private extractProjectNameFromTitle(title: string): string {
    // Remove common news prefixes and suffixes
    let cleanTitle = title
      .replace(/^(New|Latest|Breaking|Update|News):\s*/i, '')
      .replace(/\s*-\s*(The Straits Times|Channel NewsAsia|PropertyGuru).*$/i, '')
      .trim();

    // Limit length
    if (cleanTitle.length > 100) {
      cleanTitle = cleanTitle.substring(0, 97) + '...';
    }

    return cleanTitle || title;
  }

  private extractAnnouncementDate(article: ProcessedArticle, entities: EntityExtractionResult): Date {
    // Try to extract announcement date from content, fallback to publish date
    const text = article.content.toLowerCase();
    
    // Look for announcement patterns
    const announcementPatterns = [
      /announced?\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+20\d{2})/gi,
      /revealed?\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+20\d{2})/gi,
      /launched?\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+20\d{2})/gi
    ];

    for (const pattern of announcementPatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }

    // Fallback to publish date
    return article.publishDate;
  }

  private extractCompletionDate(article: ProcessedArticle, entities: EntityExtractionResult): Date | undefined {
    const text = article.content.toLowerCase();
    
    // Look for completion patterns
    const completionPatterns = [
      /(?:complete|finish|open|launch)(?:d|s)?\s+(?:by|in|on)\s+(\w+\s+20\d{2})/gi,
      /(?:expected|scheduled|planned)\s+(?:to\s+)?(?:complete|finish|open|launch)\s+(?:by|in|on)\s+(\w+\s+20\d{2})/gi,
      /(?:completion|opening|launch)\s+(?:date|is|in)\s+(\w+\s+20\d{2})/gi
    ];

    for (const pattern of completionPatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }

    // Check extracted dates for future dates
    for (const dateStr of entities.dates) {
      const parsedDate = new Date(dateStr);
      if (!isNaN(parsedDate.getTime()) && parsedDate > new Date()) {
        return parsedDate;
      }
    }

    return undefined;
  }

  private generateDescription(
    article: ProcessedArticle,
    classification: DevelopmentClassification,
    entities: EntityExtractionResult
  ): string {
    const parts: string[] = [];

    // Add development type and key details
    parts.push(`${classification.type.charAt(0).toUpperCase() + classification.type.slice(1)} development`);

    // Add organizations if available
    if (entities.organizations.length > 0) {
      parts.push(`by ${entities.organizations.slice(0, 2).join(' and ')}`);
    }

    // Add locations if available
    if (entities.locations.length > 0) {
      parts.push(`in ${entities.locations.slice(0, 2).join(' and ')}`);
    }

    // Add amounts if available
    if (entities.amounts.length > 0) {
      parts.push(`with investment of ${entities.amounts[0]}`);
    }

    // Add key keywords
    if (classification.keywords.length > 0) {
      const keyKeywords = classification.keywords.slice(0, 3).join(', ');
      parts.push(`featuring ${keyKeywords}`);
    }

    let description = parts.join(' ');

    // Ensure description is not too long
    if (description.length > 500) {
      description = description.substring(0, 497) + '...';
    }

    return description;
  }

  /**
   * Batch process multiple areas
   */
  public async processBatch(
    articlesByArea: Map<string, ProcessedArticle[]>
  ): Promise<ServiceResponse<Map<string, ProcessingResult>>> {
    const results = new Map<string, ProcessingResult>();
    const errors: string[] = [];

    for (const [areaId, articles] of articlesByArea) {
      try {
        const result = await this.processArticles(articles, areaId);
        if (result.success && result.data) {
          results.set(areaId, result.data);
        } else {
          errors.push(`Failed to process area ${areaId}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`Error processing area ${areaId}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Get processing statistics
   */
  public async getProcessingStatistics(areaId?: string): Promise<{
    totalDevelopments: number;
    byType: { [key: string]: number };
    avgImpactScore: number;
    recentProcessingCount: number;
  }> {
    try {
      const developments = areaId 
        ? await this.developmentRepository.findByAreaId(areaId)
        : await this.developmentRepository.findAll();

      const byType = {
        school: 0,
        infrastructure: 0,
        shopping: 0,
        business: 0
      };

      let totalImpactScore = 0;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let recentCount = 0;

      for (const dev of developments) {
        byType[dev.type]++;
        totalImpactScore += dev.impactScore;
        if (dev.createdAt > oneWeekAgo) {
          recentCount++;
        }
      }

      return {
        totalDevelopments: developments.length,
        byType,
        avgImpactScore: developments.length > 0 ? totalImpactScore / developments.length : 0,
        recentProcessingCount: recentCount
      };

    } catch (error) {
      console.error('Error getting processing statistics:', error);
      return {
        totalDevelopments: 0,
        byType: { school: 0, infrastructure: 0, shopping: 0, business: 0 },
        avgImpactScore: 0,
        recentProcessingCount: 0
      };
    }
  }
}