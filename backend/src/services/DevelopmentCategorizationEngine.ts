import { ProcessedArticle } from '../types';

export interface EntityExtractionResult {
  projectNames: string[];
  locations: string[];
  organizations: string[];
  dates: string[];
  amounts: string[];
}

export interface DevelopmentClassification {
  type: 'school' | 'infrastructure' | 'shopping' | 'business';
  confidence: number;
  keywords: string[];
}

export interface ImpactScoreFactors {
  projectScale: number; // 0-3 (small, medium, large, mega)
  timelineUrgency: number; // 0-3 (distant, planned, ongoing, completed)
  economicValue: number; // 0-3 (low, medium, high, very high)
  publicBenefit: number; // 0-3 (limited, moderate, significant, transformative)
  locationSignificance: number; // 0-3 (local, district, regional, national)
}

export class DevelopmentCategorizationEngine {
  private developmentPatterns = {
    school: {
      keywords: [
        'school', 'education', 'educational', 'primary school', 'secondary school',
        'junior college', 'jc', 'university', 'polytechnic', 'institute',
        'academy', 'campus', 'student', 'learning', 'curriculum', 'moe',
        'ministry of education', 'classroom', 'library', 'laboratory',
        'kindergarten', 'preschool', 'tuition', 'enrichment'
      ],
      patterns: [
        /\b(?:new|build|construct|establish|open)\s+(?:primary|secondary)?\s*school\b/gi,
        /\b(?:university|polytechnic|institute)\s+(?:campus|branch|expansion)\b/gi,
        /\beducational?\s+(?:facility|complex|hub|center|centre)\b/gi,
        /\bmoe\s+(?:announce|plan|approve)\b/gi
      ],
      impactMultipliers: {
        'university': 3.0,
        'polytechnic': 2.5,
        'junior college': 2.0,
        'secondary school': 1.5,
        'primary school': 1.2,
        'kindergarten': 1.0
      }
    },
    infrastructure: {
      keywords: [
        'mrt', 'lrt', 'train', 'station', 'transport', 'transportation',
        'road', 'highway', 'expressway', 'bridge', 'tunnel', 'infrastructure',
        'construction', 'development', 'upgrade', 'renovation', 'expansion',
        'connectivity', 'accessibility', 'public transport', 'bus', 'interchange',
        'terminal', 'depot', 'line', 'network', 'rail', 'track'
      ],
      patterns: [
        /\b(?:new|build|construct)\s+(?:mrt|lrt)\s+(?:line|station|network)\b/gi,
        /\b(?:road|highway|expressway)\s+(?:construction|upgrade|expansion)\b/gi,
        /\btransport\s+(?:hub|interchange|terminal|infrastructure)\b/gi,
        /\b(?:bridge|tunnel|viaduct)\s+(?:construction|project)\b/gi
      ],
      impactMultipliers: {
        'mrt': 3.0,
        'lrt': 2.5,
        'expressway': 2.0,
        'interchange': 2.0,
        'bridge': 1.5,
        'road': 1.2
      }
    },
    shopping: {
      keywords: [
        'mall', 'shopping', 'retail', 'store', 'outlet', 'plaza', 'centre', 'center',
        'supermarket', 'hypermarket', 'department store', 'boutique', 'shop',
        'commercial', 'marketplace', 'bazaar', 'food court', 'restaurant',
        'dining', 'f&b', 'food and beverage', 'tenant', 'anchor', 'flagship'
      ],
      patterns: [
        /\b(?:new|open|launch)\s+(?:shopping\s+)?(?:mall|centre|center|plaza)\b/gi,
        /\bretail\s+(?:development|complex|hub|destination)\b/gi,
        /\b(?:supermarket|hypermarket|department\s+store)\s+(?:open|launch)\b/gi,
        /\bcommercial\s+(?:development|complex|project)\b/gi
      ],
      impactMultipliers: {
        'mall': 2.5,
        'hypermarket': 2.0,
        'department store': 1.8,
        'supermarket': 1.5,
        'food court': 1.2,
        'retail': 1.0
      }
    },
    business: {
      keywords: [
        'office', 'business', 'corporate', 'headquarters', 'hq', 'commercial',
        'tower', 'building', 'complex', 'park', 'hub', 'center', 'centre',
        'workspace', 'coworking', 'enterprise', 'company', 'firm', 'organization',
        'cbd', 'central business district', 'financial', 'banking', 'fintech'
      ],
      patterns: [
        /\b(?:new|build|construct)\s+(?:office|business)\s+(?:tower|building|complex)\b/gi,
        /\bcorporate\s+(?:headquarters|hq|campus|center|centre)\b/gi,
        /\bbusiness\s+(?:park|hub|district|precinct)\b/gi,
        /\bcommercial\s+(?:tower|building|development)\b/gi
      ],
      impactMultipliers: {
        'headquarters': 3.0,
        'business park': 2.5,
        'office tower': 2.0,
        'commercial complex': 1.8,
        'coworking': 1.2,
        'office': 1.0
      }
    }
  };

  private scaleKeywords = {
    mega: ['billion', 'mega', 'massive', 'largest', 'major', 'flagship', 'landmark'],
    large: ['million', 'large', 'significant', 'substantial', 'comprehensive', 'extensive'],
    medium: ['moderate', 'standard', 'regular', 'typical', 'conventional'],
    small: ['small', 'minor', 'limited', 'pilot', 'trial', 'phase']
  };

  private timelineKeywords = {
    completed: ['completed', 'opened', 'launched', 'inaugurated', 'operational'],
    ongoing: ['under construction', 'building', 'developing', 'progress', 'ongoing'],
    planned: ['planned', 'approved', 'scheduled', 'expected', 'proposed', 'upcoming'],
    distant: ['future', 'long-term', 'eventual', 'potential', 'consideration']
  };

  /**
   * Classify development type using NLP-based text analysis
   */
  public classifyDevelopmentType(article: ProcessedArticle): DevelopmentClassification {
    const text = (article.title + ' ' + article.content).toLowerCase();
    const scores: { [key: string]: number } = {};

    // Calculate scores for each development type
    for (const [type, config] of Object.entries(this.developmentPatterns)) {
      let score = 0;

      // Keyword matching with frequency weighting
      for (const keyword of config.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          score += matches.length * 1.0;
        }
      }

      // Pattern matching with higher weight
      for (const pattern of config.patterns) {
        const matches = text.match(pattern);
        if (matches) {
          score += matches.length * 2.0;
        }
      }

      // Context-based scoring
      score += this.calculateContextScore(text, type);

      scores[type] = score;
    }

    // Find the highest scoring type
    const maxScore = Math.max(...Object.values(scores));
    const bestType = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0];

    if (!bestType || maxScore === 0) {
      return {
        type: 'business', // Default fallback
        confidence: 0.1,
        keywords: []
      };
    }

    // Calculate confidence based on score distribution
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0;

    // Extract matched keywords
    const matchedKeywords = this.extractMatchedKeywords(text, bestType);

    return {
      type: bestType as 'school' | 'infrastructure' | 'shopping' | 'business',
      confidence: Math.min(confidence, 1.0),
      keywords: matchedKeywords
    };
  }

  /**
   * Extract entities from article text
   */
  public extractEntities(article: ProcessedArticle): EntityExtractionResult {
    const text = article.title + ' ' + article.content;

    return {
      projectNames: this.extractProjectNames(text),
      locations: this.extractLocations(text),
      organizations: this.extractOrganizations(text),
      dates: this.extractDates(text),
      amounts: this.extractAmounts(text)
    };
  }

  /**
   * Calculate development impact score based on multiple factors
   */
  public calculateImpactScore(
    article: ProcessedArticle,
    classification: DevelopmentClassification,
    entities: EntityExtractionResult
  ): number {
    const factors = this.analyzeImpactFactors(article, classification, entities);
    
    // Weighted scoring system
    const weights = {
      projectScale: 0.25,
      timelineUrgency: 0.20,
      economicValue: 0.25,
      publicBenefit: 0.20,
      locationSignificance: 0.10
    };

    let baseScore = 0;
    baseScore += factors.projectScale * weights.projectScale;
    baseScore += factors.timelineUrgency * weights.timelineUrgency;
    baseScore += factors.economicValue * weights.economicValue;
    baseScore += factors.publicBenefit * weights.publicBenefit;
    baseScore += factors.locationSignificance * weights.locationSignificance;

    // Apply type-specific multipliers
    const typeMultiplier = this.getTypeMultiplier(classification, entities);
    
    // Apply confidence penalty
    const confidencePenalty = Math.max(0.5, classification.confidence);
    
    // Final score calculation (0-10 scale)
    const finalScore = (baseScore * 3.33) * typeMultiplier * confidencePenalty;
    
    return Math.min(Math.max(finalScore, 0), 10);
  }

  private calculateContextScore(text: string, type: string): number {
    let contextScore = 0;

    // Look for contextual indicators
    const contextPatterns = {
      school: [
        /\bstudent\s+(?:enrollment|capacity|population)\b/gi,
        /\beducational?\s+(?:program|curriculum|facility)\b/gi,
        /\bteacher\s+(?:training|recruitment)\b/gi
      ],
      infrastructure: [
        /\bcommuter\s+(?:convenience|accessibility)\b/gi,
        /\btraffic\s+(?:flow|congestion|improvement)\b/gi,
        /\bconnectivity\s+(?:enhancement|improvement)\b/gi
      ],
      shopping: [
        /\bretail\s+(?:tenant|occupancy|footfall)\b/gi,
        /\bshopping\s+(?:experience|destination|convenience)\b/gi,
        /\bf&b\s+(?:outlet|option|variety)\b/gi
      ],
      business: [
        /\bemployment\s+(?:opportunity|creation|generation)\b/gi,
        /\beconomic\s+(?:growth|development|impact)\b/gi,
        /\bbusiness\s+(?:hub|cluster|ecosystem)\b/gi
      ]
    };

    const patterns = contextPatterns[type as keyof typeof contextPatterns] || [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        contextScore += matches.length * 0.5;
      }
    }

    return contextScore;
  }

  private extractMatchedKeywords(text: string, type: string): string[] {
    const config = this.developmentPatterns[type as keyof typeof this.developmentPatterns];
    const matched: string[] = [];

    for (const keyword of config.keywords) {
      if (text.includes(keyword)) {
        matched.push(keyword);
      }
    }

    return matched.slice(0, 10); // Limit to top 10 keywords
  }

  private extractProjectNames(text: string): string[] {
    const patterns = [
      // Capitalized project names with common suffixes
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:Mall|Centre|Center|Tower|Building|Complex|Park|Station|School|Hospital|Hub|Plaza|Point|Junction|Gardens|Residences|Suites)\b/g,
      // Quoted project names
      /"([^"]+(?:Mall|Centre|Center|Tower|Building|Complex|Park|Station|School|Hospital|Hub|Plaza|Point|Junction|Gardens|Residences|Suites)[^"]*)"/g,
      // The + Project Name pattern
      /\bThe\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g
    ];

    const projects: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        projects.push(...matches);
      }
    }

    return Array.from(new Set(projects)).slice(0, 5);
  }

  private extractLocations(text: string): string[] {
    const singaporeLocations = [
      'Orchard', 'Marina Bay', 'Raffles Place', 'Tanjong Pagar', 'Chinatown',
      'Little India', 'Bugis', 'Clarke Quay', 'Sentosa', 'Jurong', 'Tampines',
      'Bedok', 'Pasir Ris', 'Woodlands', 'Yishun', 'Ang Mo Kio', 'Bishan',
      'Toa Payoh', 'Novena', 'Newton', 'Bukit Timah', 'Holland Village',
      'Clementi', 'Queenstown', 'Tiong Bahru', 'Katong', 'East Coast',
      'Changi', 'Sengkang', 'Punggol', 'Hougang', 'Serangoon', 'Dhoby Ghaut',
      'Somerset', 'City Hall', 'Harbourfront', 'Outram Park', 'Lavender'
    ];

    const locations: string[] = [];
    for (const location of singaporeLocations) {
      const regex = new RegExp(`\\b${location}\\b`, 'gi');
      if (text.match(regex)) {
        locations.push(location);
      }
    }

    return Array.from(new Set(locations));
  }

  private extractOrganizations(text: string): string[] {
    const patterns = [
      // Singapore government agencies
      /\b(?:MOE|HDB|URA|LTA|JTC|BCA|NEA|PUB|SP|SLA|IRAS|MAS|MND|MTI|MOH|MOM|MINDEF)\b/g,
      // Companies with common suffixes
      /\b[A-Z][a-zA-Z\s]+(?:Pte\s+Ltd|Ltd|Corporation|Corp|Company|Co|Group|Holdings|Development|Developments|Properties|Realty|Investment|Investments)\b/g,
      // Well-known Singapore companies
      /\b(?:CapitaLand|City Developments|Far East Organization|Keppel|Sembcorp|Mapletree|Ascendas|Frasers|GuocoLand|Wing Tai|Oxley|UOL|CDL|Wheelock)\b/gi
    ];

    const organizations: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        organizations.push(...matches);
      }
    }

    return Array.from(new Set(organizations)).slice(0, 5);
  }

  private extractDates(text: string): string[] {
    const patterns = [
      // Year patterns
      /\b(?:20(?:2[4-9]|3[0-9]))\b/g,
      // Month Year patterns
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20(?:2[4-9]|3[0-9])\b/gi,
      // Quarter patterns
      /\b(?:Q[1-4]|first|second|third|fourth)\s+quarter\s+20(?:2[4-9]|3[0-9])\b/gi,
      // Relative dates
      /\b(?:next|coming|upcoming)\s+(?:year|month|quarter)\b/gi
    ];

    const dates: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    }

    return Array.from(new Set(dates));
  }

  private extractAmounts(text: string): string[] {
    const patterns = [
      // Dollar amounts
      /\$\s*\d+(?:\.\d+)?\s*(?:million|billion|thousand|k|m|b)/gi,
      // S$ amounts
      /S\$\s*\d+(?:\.\d+)?\s*(?:million|billion|thousand|k|m|b)/gi,
      // Numeric amounts with currency words
      /\b\d+(?:\.\d+)?\s*(?:million|billion|thousand)\s*(?:dollars?|sgd)/gi
    ];

    const amounts: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        amounts.push(...matches);
      }
    }

    return Array.from(new Set(amounts));
  }

  private analyzeImpactFactors(
    article: ProcessedArticle,
    classification: DevelopmentClassification,
    entities: EntityExtractionResult
  ): ImpactScoreFactors {
    const text = (article.title + ' ' + article.content).toLowerCase();

    return {
      projectScale: this.assessProjectScale(text, entities),
      timelineUrgency: this.assessTimelineUrgency(text, entities),
      economicValue: this.assessEconomicValue(text, entities),
      publicBenefit: this.assessPublicBenefit(text, classification.type),
      locationSignificance: this.assessLocationSignificance(entities.locations)
    };
  }

  private assessProjectScale(text: string, entities: EntityExtractionResult): number {
    // Check for scale indicators
    for (const [scale, keywords] of Object.entries(this.scaleKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          switch (scale) {
            case 'mega': return 3;
            case 'large': return 2;
            case 'medium': return 1;
            case 'small': return 0;
          }
        }
      }
    }

    // Check monetary amounts
    const hasLargeAmount = entities.amounts.some(amount => 
      amount.toLowerCase().includes('billion') || 
      (amount.toLowerCase().includes('million') && 
       parseInt(amount.match(/\d+/)?.[0] || '0') > 100)
    );

    if (hasLargeAmount) return 3;

    // Default to medium scale
    return 1;
  }

  private assessTimelineUrgency(text: string, entities: EntityExtractionResult): number {
    for (const [timeline, keywords] of Object.entries(this.timelineKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          switch (timeline) {
            case 'completed': return 3;
            case 'ongoing': return 2;
            case 'planned': return 1;
            case 'distant': return 0;
          }
        }
      }
    }

    // Check for specific years
    const currentYear = new Date().getFullYear();
    const hasNearTermDate = entities.dates.some(date => {
      const year = parseInt(date.match(/20\d{2}/)?.[0] || '0');
      return year > 0 && year <= currentYear + 2;
    });

    return hasNearTermDate ? 2 : 1;
  }

  private assessEconomicValue(text: string, entities: EntityExtractionResult): number {
    // Check for economic indicators
    const economicKeywords = [
      'investment', 'funding', 'budget', 'cost', 'value', 'worth',
      'economic impact', 'job creation', 'employment', 'gdp', 'revenue'
    ];

    let economicScore = 0;
    for (const keyword of economicKeywords) {
      if (text.includes(keyword)) {
        economicScore += 0.5;
      }
    }

    // Check amounts
    const hasBillionAmount = entities.amounts.some(amount => 
      amount.toLowerCase().includes('billion')
    );
    const hasMillionAmount = entities.amounts.some(amount => 
      amount.toLowerCase().includes('million')
    );

    if (hasBillionAmount) return 3;
    if (hasMillionAmount) return Math.min(2, economicScore + 1);
    
    return Math.min(3, Math.floor(economicScore));
  }

  private assessPublicBenefit(text: string, type: string): number {
    const benefitKeywords = {
      school: ['education', 'student', 'learning', 'community', 'public'],
      infrastructure: ['connectivity', 'accessibility', 'transport', 'public', 'commuter'],
      shopping: ['convenience', 'retail', 'consumer', 'community', 'local'],
      business: ['employment', 'job', 'economic', 'growth', 'development']
    };

    const keywords = benefitKeywords[type as keyof typeof benefitKeywords] || [];
    let benefitScore = 0;

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        benefitScore += 0.5;
      }
    }

    // Type-based base scores
    const typeBaseScores = {
      school: 2,
      infrastructure: 3,
      shopping: 1,
      business: 1
    };

    const baseScore = typeBaseScores[type as keyof typeof typeBaseScores] || 1;
    return Math.min(3, baseScore + Math.floor(benefitScore));
  }

  private assessLocationSignificance(locations: string[]): number {
    const significantLocations = {
      national: ['Marina Bay', 'Raffles Place', 'Orchard', 'Changi', 'Jurong'],
      regional: ['Tampines', 'Woodlands', 'Sengkang', 'Punggol', 'Bishan'],
      district: ['Novena', 'Toa Payoh', 'Ang Mo Kio', 'Bedok', 'Clementi'],
      local: [] // All others
    };

    for (const location of locations) {
      if (significantLocations.national.includes(location)) return 3;
      if (significantLocations.regional.includes(location)) return 2;
      if (significantLocations.district.includes(location)) return 1;
    }

    return locations.length > 0 ? 1 : 0;
  }

  private getTypeMultiplier(classification: DevelopmentClassification, entities: EntityExtractionResult): number {
    const config = this.developmentPatterns[classification.type];
    
    // Look for specific high-impact terms
    for (const [term, multiplier] of Object.entries(config.impactMultipliers)) {
      const hasHighImpactTerm = entities.projectNames.some(name => 
        name.toLowerCase().includes(term.toLowerCase())
      ) || classification.keywords.includes(term);
      
      if (hasHighImpactTerm) {
        return multiplier;
      }
    }

    return 1.0; // Default multiplier
  }
}