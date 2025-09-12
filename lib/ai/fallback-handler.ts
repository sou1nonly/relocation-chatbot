/**
 * Fallback & Clarification Logic for Web Search
 * Handles weak results and provides intelligent query suggestions
 */

import type { QueryIntent } from './intent-classifier';
import type { RewrittenQuery } from './query-rewriter';
import type { FilteredResults } from './semantic-filter';

export interface FallbackStrategy {
  type: 'refine' | 'broaden' | 'redirect' | 'clarify' | 'alternative_source';
  confidence: number;
  reasoning: string;
  suggestedActions: string[];
  alternativeQueries?: string[];
  clarifyingQuestions?: string[];
  recommendedSources?: string[];
}

export interface FallbackResponse {
  shouldFallback: boolean;
  strategy: FallbackStrategy;
  enhancedMessage: string;
  userGuidance: string[];
  nextSteps: string[];
}

export class SearchFallbackHandler {
  private readonly weakResultThresholds = {
    resultCount: 3,
    averageScore: 0.4,
    topResultScore: 0.5,
    diversityScore: 0.3,
  };

  private readonly fallbackTemplates = {
    refine:
      "I found some results, but they might not be exactly what you're looking for. Try being more specific about:",
    broaden:
      'I found limited results. You might want to search for something broader like:',
    redirect:
      'Based on your query, you might be interested in these related topics:',
    clarify:
      'I need a bit more information to find the best results. Could you tell me:',
    alternative_source:
      'The current results are limited. You might find better information by checking:',
  };

  private readonly commonClarifyingQuestions = {
    location: [
      'Which specific city or region are you interested in?',
      'Are you looking for information about a particular neighborhood?',
      'Should I focus on a specific geographic area?',
    ],
    timeframe: [
      'Are you looking for current information or historical data?',
      'What time period should I focus on?',
      'Do you need the most recent updates?',
    ],
    scope: [
      'Are you looking for general information or something specific?',
      'Should I focus on particular aspects of this topic?',
      "What's the main purpose of your search?",
    ],
    personal: [
      'Are you planning to visit, move there, or just researching?',
      'What are your main priorities or concerns?',
      'Are you looking for personal experiences or official data?',
    ],
  };

  /**
   * Analyze search results and determine if fallback is needed
   */
  analyzeFallbackNeeds(
    results: FilteredResults,
    intent: QueryIntent,
    originalQuery: string,
    rewrittenQuery?: RewrittenQuery,
  ): FallbackResponse {
    const shouldFallback = this.shouldTriggerFallback(results, intent);

    if (!shouldFallback) {
      return {
        shouldFallback: false,
        strategy: {
          type: 'refine',
          confidence: 1.0,
          reasoning: 'Results are adequate',
          suggestedActions: [],
        },
        enhancedMessage: 'Found good results for your query.',
        userGuidance: [],
        nextSteps: [],
      };
    }

    const strategy = this.determineFallbackStrategy(
      results,
      intent,
      originalQuery,
    );
    const enhancedMessage = this.generateEnhancedMessage(
      strategy,
      originalQuery,
    );
    const userGuidance = this.generateUserGuidance(
      strategy,
      intent,
      originalQuery,
    );
    const nextSteps = this.generateNextSteps(strategy, intent);

    return {
      shouldFallback: true,
      strategy,
      enhancedMessage,
      userGuidance,
      nextSteps,
    };
  }

  private shouldTriggerFallback(
    results: FilteredResults,
    intent: QueryIntent,
  ): boolean {
    const { resultCount, averageScore, topResultScore, diversityScore } =
      this.calculateResultMetrics(results);

    // Multiple conditions that indicate weak results
    const conditions = [
      resultCount < this.weakResultThresholds.resultCount,
      averageScore < this.weakResultThresholds.averageScore,
      topResultScore < this.weakResultThresholds.topResultScore,
      diversityScore < this.weakResultThresholds.diversityScore,
      results.summary.weakResults,
      intent.confidence.needsWebSearch > 0.8 && resultCount === 0, // High expectation, no results
    ];

    // Trigger fallback if 2 or more conditions are met
    const triggeredConditions = conditions.filter(Boolean).length;
    return triggeredConditions >= 2;
  }

  private calculateResultMetrics(results: FilteredResults): {
    resultCount: number;
    averageScore: number;
    topResultScore: number;
    diversityScore: number;
  } {
    const resultCount = results.results.length;
    const averageScore = results.summary.averageScore;
    const topResultScore = results.results[0]?.finalScore || 0;

    // Calculate diversity based on unique domains and source types
    const uniqueDomains = new Set(results.results.map((r) => r.domain)).size;
    const uniqueSourceTypes = new Set(results.results.map((r) => r.sourceType))
      .size;
    const diversityScore =
      resultCount > 0
        ? (uniqueDomains + uniqueSourceTypes) / (resultCount * 2)
        : 0;

    return { resultCount, averageScore, topResultScore, diversityScore };
  }

  private determineFallbackStrategy(
    results: FilteredResults,
    intent: QueryIntent,
    originalQuery: string,
  ): FallbackStrategy {
    const metrics = this.calculateResultMetrics(results);
    const queryAnalysis = this.analyzeQueryCharacteristics(
      originalQuery,
      intent,
    );

    // Strategy selection logic
    if (metrics.resultCount === 0) {
      return this.createBroadenStrategy(queryAnalysis, intent);
    }

    if (metrics.averageScore < 0.3) {
      return this.createRefineStrategy(queryAnalysis, intent, results);
    }

    if (queryAnalysis.isVague || queryAnalysis.needsContext) {
      return this.createClarifyStrategy(queryAnalysis, intent);
    }

    if (metrics.diversityScore < 0.2) {
      return this.createAlternativeSourceStrategy(queryAnalysis, intent);
    }

    // Default to refine strategy
    return this.createRefineStrategy(queryAnalysis, intent, results);
  }

  private analyzeQueryCharacteristics(
    query: string,
    intent: QueryIntent,
  ): {
    isVague: boolean;
    isTooSpecific: boolean;
    needsContext: boolean;
    missingLocation: boolean;
    missingTimeframe: boolean;
    queryLength: number;
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const words = query.split(/\s+/);
    const queryLength = words.length;

    return {
      isVague:
        queryLength < 3 ||
        (!query.includes('?') && words.every((w) => w.length < 6)),
      isTooSpecific: queryLength > 12 && intent.entities.locations.length === 0,
      needsContext:
        intent.confidence.personalRelevance > 0.7 &&
        intent.entities.locations.length === 0,
      missingLocation:
        intent.confidence.locationRelevance > 0.5 &&
        intent.entities.locations.length === 0,
      missingTimeframe:
        intent.confidence.temporalRelevance > 0.6 &&
        intent.entities.timeReferences.length === 0,
      queryLength,
      complexity:
        queryLength < 4 ? 'simple' : queryLength < 8 ? 'moderate' : 'complex',
    };
  }

  private createRefineStrategy(
    queryAnalysis: any,
    intent: QueryIntent,
    results: FilteredResults,
  ): FallbackStrategy {
    const suggestedActions: string[] = [];
    const alternativeQueries: string[] = [];

    if (queryAnalysis.missingLocation) {
      suggestedActions.push('Add a specific city or location');
      alternativeQueries.push(`${intent.entities.topics[0]} in [your city]`);
    }

    if (
      queryAnalysis.missingTimeframe &&
      intent.confidence.temporalRelevance > 0.6
    ) {
      suggestedActions.push('Specify a time period (current, recent, 2025)');
      alternativeQueries.push(`current ${intent.entities.topics[0]}`);
    }

    // Add topic-specific suggestions
    if (intent.entities.topics.length > 0) {
      const mainTopic = intent.entities.topics[0];
      alternativeQueries.push(`best ${mainTopic}`);
      alternativeQueries.push(`${mainTopic} guide`);
      alternativeQueries.push(`${mainTopic} tips`);
    }

    return {
      type: 'refine',
      confidence: 0.8,
      reasoning: 'Results exist but have low relevance scores',
      suggestedActions,
      alternativeQueries: alternativeQueries.slice(0, 3),
    };
  }

  private createBroadenStrategy(
    queryAnalysis: any,
    intent: QueryIntent,
  ): FallbackStrategy {
    const alternativeQueries: string[] = [];
    const suggestedActions: string[] = [];

    if (intent.entities.topics.length > 0) {
      const topics = intent.entities.topics;

      // Suggest broader versions of the query
      alternativeQueries.push(topics[0]); // Single main topic

      if (topics.length > 1) {
        alternativeQueries.push(`${topics[0]} OR ${topics[1]}`);
      }

      // Add general relocation context if relevant
      if (intent.primaryIntent === 'planning') {
        alternativeQueries.push(`relocation guide`);
        alternativeQueries.push(`moving tips`);
      }
    }

    suggestedActions.push('Use fewer, more general terms');
    suggestedActions.push('Remove very specific requirements');
    suggestedActions.push('Try searching for broader categories');

    return {
      type: 'broaden',
      confidence: 0.7,
      reasoning: 'No results found, query may be too specific',
      suggestedActions,
      alternativeQueries: alternativeQueries.slice(0, 3),
    };
  }

  private createClarifyStrategy(
    queryAnalysis: any,
    intent: QueryIntent,
  ): FallbackStrategy {
    const clarifyingQuestions: string[] = [];

    if (queryAnalysis.missingLocation) {
      clarifyingQuestions.push(
        ...this.commonClarifyingQuestions.location.slice(0, 2),
      );
    }

    if (queryAnalysis.missingTimeframe) {
      clarifyingQuestions.push(
        ...this.commonClarifyingQuestions.timeframe.slice(0, 2),
      );
    }

    if (queryAnalysis.isVague) {
      clarifyingQuestions.push(
        ...this.commonClarifyingQuestions.scope.slice(0, 2),
      );
    }

    if (intent.confidence.personalRelevance > 0.7) {
      clarifyingQuestions.push(
        ...this.commonClarifyingQuestions.personal.slice(0, 2),
      );
    }

    return {
      type: 'clarify',
      confidence: 0.9,
      reasoning: 'Query needs more context for optimal results',
      suggestedActions: [
        'Provide more specific details',
        'Add context about your situation',
      ],
      clarifyingQuestions: clarifyingQuestions.slice(0, 4),
    };
  }

  private createAlternativeSourceStrategy(
    queryAnalysis: any,
    intent: QueryIntent,
  ): FallbackStrategy {
    const recommendedSources: string[] = [];

    // Suggest sources based on intent type
    switch (intent.primaryIntent) {
      case 'factual':
        recommendedSources.push('Official government websites (.gov)');
        recommendedSources.push('Academic institutions (.edu)');
        recommendedSources.push('Wikipedia for general information');
        break;

      case 'recommendation':
        recommendedSources.push('Review sites (Yelp, TripAdvisor)');
        recommendedSources.push('Local community forums (Reddit)');
        recommendedSources.push('Travel and lifestyle blogs');
        break;

      case 'comparison':
        recommendedSources.push('City comparison websites');
        recommendedSources.push('Cost of living calculators');
        recommendedSources.push('Real estate market reports');
        break;

      case 'status':
        recommendedSources.push('News websites');
        recommendedSources.push('Official city/state websites');
        recommendedSources.push('Real-time data sources');
        break;
    }

    return {
      type: 'alternative_source',
      confidence: 0.6,
      reasoning: 'Limited source diversity in current results',
      suggestedActions: [
        'Try different types of sources',
        'Look for specialized databases',
      ],
      recommendedSources: recommendedSources.slice(0, 3),
    };
  }

  private generateEnhancedMessage(
    strategy: FallbackStrategy,
    originalQuery: string,
  ): string {
    const template = this.fallbackTemplates[strategy.type];

    switch (strategy.type) {
      case 'refine':
        return `${template} ${strategy.suggestedActions.join(', ').toLowerCase()}.`;

      case 'broaden':
        return `${template} ${strategy.alternativeQueries?.join(', ') || 'more general terms'}.`;

      case 'clarify':
        return `${template} ${strategy.clarifyingQuestions?.[0] || "more details about what you're looking for"}.`;

      case 'alternative_source':
        return `${template} ${strategy.recommendedSources?.join(', ') || 'different types of sources'}.`;

      default:
        return 'Let me help you find better results with a refined search.';
    }
  }

  private generateUserGuidance(
    strategy: FallbackStrategy,
    intent: QueryIntent,
    originalQuery: string,
  ): string[] {
    const guidance: string[] = [];

    // Always include the primary suggestion
    guidance.push(this.generateEnhancedMessage(strategy, originalQuery));

    // Add strategy-specific guidance
    if (strategy.alternativeQueries?.length) {
      guidance.push(`Try searching for: "${strategy.alternativeQueries[0]}"`);
    }

    if (strategy.clarifyingQuestions?.length) {
      guidance.push(`Consider: ${strategy.clarifyingQuestions[0]}`);
    }

    if (strategy.recommendedSources?.length) {
      guidance.push(`Check: ${strategy.recommendedSources[0]}`);
    }

    // Add intent-specific tips
    if (
      intent.confidence.locationRelevance > 0.6 &&
      intent.entities.locations.length === 0
    ) {
      guidance.push(
        '💡 Tip: Adding a specific city name usually improves results significantly.',
      );
    }

    if (
      intent.confidence.temporalRelevance > 0.6 &&
      intent.entities.timeReferences.length === 0
    ) {
      guidance.push(
        "💡 Tip: Specify if you need current information by adding '2025' or 'current' to your search.",
      );
    }

    return guidance;
  }

  private generateNextSteps(
    strategy: FallbackStrategy,
    intent: QueryIntent,
  ): string[] {
    const steps: string[] = [];

    switch (strategy.type) {
      case 'refine':
        steps.push('Rephrase your query with more specific terms');
        if (strategy.alternativeQueries?.length) {
          steps.push(`Try: "${strategy.alternativeQueries[0]}"`);
        }
        break;

      case 'broaden':
        steps.push('Use more general search terms');
        steps.push('Remove overly specific details');
        break;

      case 'clarify':
        steps.push('Provide additional context in your next message');
        if (strategy.clarifyingQuestions?.length) {
          steps.push(`Answer: ${strategy.clarifyingQuestions[0]}`);
        }
        break;

      case 'alternative_source':
        steps.push('Consider checking specialized sources');
        if (strategy.recommendedSources?.length) {
          steps.push(`Visit: ${strategy.recommendedSources[0]}`);
        }
        break;
    }

    steps.push('Ask me to search again with your refined query');

    return steps;
  }

  /**
   * Generate a comprehensive fallback response message
   */
  generateFallbackMessage(
    fallbackResponse: FallbackResponse,
    results: FilteredResults,
  ): string {
    if (!fallbackResponse.shouldFallback) {
      return '';
    }

    const parts: string[] = [];

    // Main message
    parts.push(fallbackResponse.enhancedMessage);

    // Results summary if any exist
    if (results.results.length > 0) {
      parts.push(
        `\nI found ${results.results.length} result(s), but they may not be exactly what you're looking for.`,
      );
    }

    // User guidance
    if (fallbackResponse.userGuidance.length > 0) {
      parts.push('\n**Suggestions:**');
      fallbackResponse.userGuidance.forEach((guide, index) => {
        if (index === 0) {
          parts.push(`• ${guide}`);
        } else {
          parts.push(`• ${guide}`);
        }
      });
    }

    // Alternative queries
    if (fallbackResponse.strategy.alternativeQueries?.length) {
      parts.push('\n**Try searching for:**');
      fallbackResponse.strategy.alternativeQueries.forEach((query) => {
        parts.push(`• "${query}"`);
      });
    }

    // Clarifying questions
    if (fallbackResponse.strategy.clarifyingQuestions?.length) {
      parts.push('\n**To help me find better results:**');
      fallbackResponse.strategy.clarifyingQuestions.forEach((question) => {
        parts.push(`• ${question}`);
      });
    }

    return parts.join('\n');
  }
}
