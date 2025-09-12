/**
 * Enhanced Intent Detection and Classification System
 * Uses semantic analysis to determine web search necessity and intent types
 */

export interface QueryIntent {
  // Primary intent classification
  primaryIntent:
    | 'factual'
    | 'recommendation'
    | 'comparison'
    | 'status'
    | 'planning'
    | 'conversational';

  // Confidence scores for different aspects
  confidence: {
    needsWebSearch: number; // 0-1 scale
    temporalRelevance: number; // How time-sensitive is this query
    locationRelevance: number; // How location-specific is this query
    personalRelevance: number; // How much does this depend on user preferences
  };

  // Detected entities and context
  entities: {
    locations: string[];
    timeReferences: string[];
    topics: string[];
    comparisons: string[];
  };

  // Search strategy recommendations
  searchStrategy: {
    priority: 'high' | 'medium' | 'low' | 'skip';
    queryType: 'factual' | 'local' | 'temporal' | 'comparative' | 'exploratory';
    expectedSources: string[]; // news, reviews, official, social, etc.
  };

  // Reasoning for the decision
  reasoning: string[];
}

export interface UserContext {
  currentLocation?: string;
  targetCities?: string[];
  preferences?: {
    careerField?: string;
    lifestyle?: string[];
    priorities?: string[];
  };
  conversationHistory?: string[];
  recentTopics?: string[];
  lastWebSearch?: Date;
}

/**
 * Advanced intent classifier using semantic analysis
 */
export class IntentClassifier {
  private readonly temporalPatterns = {
    immediate: /\b(now|right now|currently|at the moment|today)\b/i,
    recent:
      /\b(recently|lately|this (week|month|year)|past (few|several)|latest)\b/i,
    future:
      /\b(will|going to|planning|future|upcoming|next (week|month|year))\b/i,
    specific:
      /\b(2024|2025|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  };

  private readonly locationPatterns = {
    specific:
      /\b(in|at|near|around|close to|within)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    general:
      /\b(city|cities|town|area|neighborhood|district|region|state|country)\b/i,
    relative: /\b(here|there|local|nearby|around here|this area)\b/i,
  };

  private readonly intentKeywords = {
    factual: [
      'what is',
      'define',
      'explain',
      'how does',
      'why',
      'when',
      'where',
    ],
    recommendation: [
      'recommend',
      'suggest',
      'best',
      'top',
      'good',
      'should i',
      'where should',
      'hidden gems',
      'must visit',
    ],
    comparison: [
      'vs',
      'versus',
      'compare',
      'better',
      'difference',
      'which is',
      'pros and cons',
    ],
    status: ['is', 'are', 'status', 'available', 'open', 'closed', 'happening'],
    planning: [
      'planning',
      'thinking about',
      'considering',
      'help me',
      'advice',
      'guidance',
    ],
  };

  private readonly highPriorityTopics = [
    'housing market',
    'job market',
    'crime rate',
    'weather',
    'cost of living',
    'school district',
    'transportation',
    'healthcare',
    'emergency',
    'breaking news',
    'travel conditions',
    'road conditions',
    'safety',
    'trek',
    'trekking',
    'visiting',
    'trip',
    'travel',
    'going to',
  ];

  /**
   * Classify user query intent with confidence scores
   */
  classifyIntent(query: string, context?: UserContext): QueryIntent {
    const normalizedQuery = query.toLowerCase().trim();

    // Extract entities
    const entities = this.extractEntities(query);

    // Determine primary intent
    const primaryIntent = this.determinePrimaryIntent(normalizedQuery);

    // Calculate confidence scores
    const confidence = this.calculateConfidenceScores(
      normalizedQuery,
      entities,
      context,
    );

    // Determine search strategy
    const searchStrategy = this.determineSearchStrategy(
      primaryIntent,
      confidence,
      entities,
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(
      primaryIntent,
      confidence,
      entities,
      context,
    );

    return {
      primaryIntent,
      confidence,
      entities,
      searchStrategy,
      reasoning,
    };
  }

  private extractEntities(query: string): QueryIntent['entities'] {
    const entities: QueryIntent['entities'] = {
      locations: [],
      timeReferences: [],
      topics: [],
      comparisons: [],
    };

    // Extract locations
    const locationMatches = Array.from(
      query.matchAll(this.locationPatterns.specific),
    );
    entities.locations = locationMatches
      .map((match) => match[2])
      .filter(Boolean);

    // Extract time references
    Object.entries(this.temporalPatterns).forEach(([type, pattern]) => {
      const matches = query.match(pattern);
      if (matches) {
        entities.timeReferences.push(...matches);
      }
    });

    // Extract topics (simple keyword extraction for now)
    const topicWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          !['the', 'and', 'or', 'but', 'for', 'with', 'about'].includes(word),
      );
    entities.topics = topicWords.slice(0, 5); // Top 5 relevant words

    // Extract comparison indicators
    if (
      /\b(vs|versus|compare|better than|worse than|difference between)\b/i.test(
        query,
      )
    ) {
      const parts = query.split(
        /\b(vs|versus|compare|better than|worse than|difference between)\b/i,
      );
      if (parts.length > 1) {
        entities.comparisons = parts.filter((part) => part.trim().length > 2);
      }
    }

    return entities;
  }

  private determinePrimaryIntent(query: string): QueryIntent['primaryIntent'] {
    let maxScore = 0;
    let primaryIntent: QueryIntent['primaryIntent'] = 'conversational';

    Object.entries(this.intentKeywords).forEach(([intent, keywords]) => {
      const score = keywords.reduce((sum, keyword) => {
        return sum + (query.includes(keyword) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        primaryIntent = intent as QueryIntent['primaryIntent'];
      }
    });

    // Special case for planning queries
    if (
      /\b(move to|relocat|thinking about|considering|planning)\b/i.test(query)
    ) {
      primaryIntent = 'planning';
    }

    return primaryIntent;
  }

  private calculateConfidenceScores(
    query: string,
    entities: QueryIntent['entities'],
    context?: UserContext,
  ): QueryIntent['confidence'] {
    let webSearchScore = 0;
    let temporalScore = 0;
    let locationScore = 0;
    let personalScore = 0;

    // Web search need indicators
    if (entities.timeReferences.length > 0) webSearchScore += 0.3;
    if (entities.locations.length > 0) webSearchScore += 0.2;
    if (this.highPriorityTopics.some((topic) => query.includes(topic)))
      webSearchScore += 0.4;
    if (/\b(current|latest|recent|news|market|price)\b/i.test(query))
      webSearchScore += 0.3;
    if (/\b(review|rating|opinion|experience)\b/i.test(query))
      webSearchScore += 0.25;

    // Travel and trip-specific indicators
    if (
      /\b(safe|safety|conditions|weather|traveling|visiting|going to|trip to)\b/i.test(
        query,
      )
    )
      webSearchScore += 0.3;
    if (
      /\b(next week|tomorrow|this weekend|soon|planning to go)\b/i.test(query)
    )
      webSearchScore += 0.2;

    // Temporal relevance
    if (this.temporalPatterns.immediate.test(query)) temporalScore = 0.9;
    else if (this.temporalPatterns.recent.test(query)) temporalScore = 0.7;
    else if (this.temporalPatterns.future.test(query)) temporalScore = 0.4;
    else if (this.temporalPatterns.specific.test(query)) temporalScore = 0.6;
    else temporalScore = 0.1;

    // Location relevance
    locationScore = Math.min(entities.locations.length * 0.3, 0.9);
    if (this.locationPatterns.relative.test(query)) locationScore += 0.2;
    if (
      context?.targetCities?.some((city) =>
        query.toLowerCase().includes(city.toLowerCase()),
      )
    )
      locationScore += 0.3;

    // Personal relevance
    if (
      context?.preferences?.careerField &&
      query
        .toLowerCase()
        .includes(context.preferences.careerField.toLowerCase())
    ) {
      personalScore += 0.3;
    }
    if (
      context?.conversationHistory?.some((msg) =>
        entities.topics.some((topic) => msg.toLowerCase().includes(topic)),
      )
    ) {
      personalScore += 0.2;
    }
    if (/\b(i|me|my|should i|help me|what do you think)\b/i.test(query))
      personalScore += 0.3;

    return {
      needsWebSearch: Math.min(webSearchScore, 1.0),
      temporalRelevance: temporalScore,
      locationRelevance: Math.min(locationScore, 1.0),
      personalRelevance: Math.min(personalScore, 1.0),
    };
  }

  private determineSearchStrategy(
    intent: QueryIntent['primaryIntent'],
    confidence: QueryIntent['confidence'],
    entities: QueryIntent['entities'],
  ): QueryIntent['searchStrategy'] {
    let priority: 'high' | 'medium' | 'low' | 'skip' = 'skip';
    let queryType: QueryIntent['searchStrategy']['queryType'] = 'factual';
    const expectedSources: string[] = [];

    // Determine priority
    if (confidence.needsWebSearch >= 0.7) priority = 'high';
    else if (confidence.needsWebSearch >= 0.4) priority = 'medium';
    else if (confidence.needsWebSearch >= 0.2) priority = 'low';

    // Determine query type and expected sources
    if (confidence.temporalRelevance > 0.6) {
      queryType = 'temporal';
      expectedSources.push('news', 'official');
    } else if (confidence.locationRelevance > 0.6) {
      queryType = 'local';
      expectedSources.push('reviews', 'local', 'social');
    } else if (entities.comparisons.length > 0) {
      queryType = 'comparative';
      expectedSources.push('reviews', 'analysis', 'data');
    } else if (intent === 'recommendation') {
      queryType = 'exploratory';
      expectedSources.push('reviews', 'guides', 'social');
    }

    if (expectedSources.length === 0) {
      expectedSources.push('general');
    }

    return { priority, queryType, expectedSources };
  }

  private generateReasoning(
    intent: QueryIntent['primaryIntent'],
    confidence: QueryIntent['confidence'],
    entities: QueryIntent['entities'],
    context?: UserContext,
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Primary intent: ${intent}`);

    if (confidence.needsWebSearch >= 0.7) {
      reasoning.push('High confidence web search needed');
    } else if (confidence.needsWebSearch >= 0.4) {
      reasoning.push('Moderate confidence web search beneficial');
    } else {
      reasoning.push('Low confidence web search needed');
    }

    if (confidence.temporalRelevance > 0.6) {
      reasoning.push('Time-sensitive query detected');
    }

    if (confidence.locationRelevance > 0.6) {
      reasoning.push('Location-specific information needed');
    }

    if (entities.locations.length > 0) {
      reasoning.push(`Locations mentioned: ${entities.locations.join(', ')}`);
    }

    if (entities.timeReferences.length > 0) {
      reasoning.push(`Time references: ${entities.timeReferences.join(', ')}`);
    }

    if (confidence.personalRelevance > 0.5) {
      reasoning.push('Query relates to user preferences/context');
    }

    return reasoning;
  }
}
