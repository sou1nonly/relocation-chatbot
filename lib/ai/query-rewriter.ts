/**
 * Query Rewriting System for Enhanced Web Search
 * Transforms user queries into search-optimized formats using context
 */

import type { QueryIntent, UserContext } from './intent-classifier';

export interface RewrittenQuery {
  original: string;
  rewritten: string;
  searchTerms: string[];
  context: string[];
  strategy: 'direct' | 'expanded' | 'contextual' | 'comparative';
  confidence: number;
  reasoning: string[];
}

export class QueryRewriter {
  private readonly locationExpansions: Record<string, string[]> = {
    housing: ['real estate', 'apartments', 'rent', 'buy', 'property market'],
    jobs: [
      'employment',
      'career opportunities',
      'job market',
      'hiring',
      'salaries',
    ],
    weather: [
      'climate',
      'temperature',
      'rainfall',
      'seasons',
      'weather patterns',
    ],
    cost: ['cost of living', 'expenses', 'budget', 'prices', 'affordability'],
    safety: [
      'crime rate',
      'safety statistics',
      'neighborhood safety',
      'security',
    ],
    schools: [
      'education',
      'school districts',
      'universities',
      'academic rankings',
    ],
    transport: [
      'public transit',
      'commute',
      'transportation',
      'traffic',
      'walkability',
    ],
    culture: [
      'arts',
      'museums',
      'nightlife',
      'restaurants',
      'entertainment',
      'diversity',
    ],
  };

  private readonly temporalModifiers: Record<string, string[]> = {
    immediate: ['current', 'now', 'today', '2025'],
    recent: ['recent', 'latest', 'this year', '2024', '2025'],
    future: ['upcoming', 'projected', 'forecast', 'planned'],
    historical: ['trends', 'historical data', 'over time'],
  };

  private readonly contextualFrameworks: Record<string, string> = {
    relocation: 'for people moving to',
    comparison: 'compared to other cities',
    planning: 'for someone planning to move',
    recommendation: 'best options for',
    factual: 'accurate information about',
    status: 'current status of',
  };

  /**
   * Rewrite user query for optimal web search results
   */
  rewriteQuery(
    originalQuery: string,
    intent: QueryIntent,
    context?: UserContext,
  ): RewrittenQuery {
    const strategy = this.determineStrategy(intent);
    const rewritten = this.performRewrite(
      originalQuery,
      intent,
      strategy,
      context,
    );
    const searchTerms = this.extractSearchTerms(rewritten, intent);
    const contextualInfo = this.buildContextualInfo(intent, context);
    const confidence = this.calculateRewriteConfidence(
      originalQuery,
      rewritten,
      intent,
    );
    const reasoning = this.generateRewriteReasoning(
      originalQuery,
      rewritten,
      strategy,
      intent,
    );

    return {
      original: originalQuery,
      rewritten,
      searchTerms,
      context: contextualInfo,
      strategy,
      confidence,
      reasoning,
    };
  }

  private determineStrategy(intent: QueryIntent): RewrittenQuery['strategy'] {
    if (intent.entities.comparisons.length > 0) return 'comparative';
    if (
      intent.confidence.locationRelevance > 0.6 ||
      intent.confidence.personalRelevance > 0.6
    )
      return 'contextual';
    if (intent.searchStrategy.priority === 'high') return 'expanded';
    return 'direct';
  }

  private performRewrite(
    query: string,
    intent: QueryIntent,
    strategy: RewrittenQuery['strategy'],
    context?: UserContext,
  ): string {
    let rewritten = query;

    switch (strategy) {
      case 'direct':
        rewritten = this.cleanAndDirectQuery(query);
        break;

      case 'expanded':
        rewritten = this.expandQueryWithKeywords(query, intent);
        break;

      case 'contextual':
        rewritten = this.addContextualInformation(query, intent, context);
        break;

      case 'comparative':
        rewritten = this.optimizeForComparison(query, intent, context);
        break;
    }

    return this.applyFinalOptimizations(rewritten, intent);
  }

  private cleanAndDirectQuery(query: string): string {
    // Remove conversational elements and focus on core query
    let cleaned = query
      .replace(
        /^(can you |could you |would you |please |i want to |i need |help me )/i,
        '',
      )
      .replace(/\b(tell me about|explain to me|let me know about)\b/gi, '')
      .replace(/\?+$/, '')
      .trim();

    // Remove filler words but keep important context
    cleaned = cleaned
      .replace(/\b(um|uh|well|so|like|you know)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  private expandQueryWithKeywords(query: string, intent: QueryIntent): string {
    let expanded = query;
    const queryLower = query.toLowerCase();

    // Add topic expansions based on detected topics
    Object.entries(this.locationExpansions).forEach(([topic, expansions]) => {
      if (queryLower.includes(topic)) {
        // Add 1-2 most relevant expansions
        const relevantExpansions = expansions.slice(0, 2);
        expanded = `${expanded} ${relevantExpansions.join(' OR ')}`;
      }
    });

    // Add temporal context if time-sensitive
    if (intent.confidence.temporalRelevance > 0.6) {
      const timeModifiers = this.getRelevantTimeModifiers(query);
      if (timeModifiers.length > 0) {
        expanded = `${expanded} ${timeModifiers.join(' ')}`;
      }
    }

    return expanded;
  }

  private addContextualInformation(
    query: string,
    intent: QueryIntent,
    context?: UserContext,
  ): string {
    let contextual = query;

    // Add location context
    if (
      intent.confidence.locationRelevance > 0.6 &&
      context?.targetCities?.length
    ) {
      const cities = context.targetCities.slice(0, 2).join(' OR ');
      contextual = `${contextual} in ${cities}`;
    }

    // Add user preference context
    if (
      context?.preferences?.careerField &&
      /\b(job|career|work|employment|salary)\b/i.test(query)
    ) {
      contextual = `${contextual} ${context.preferences.careerField}`;
    }

    // Add relocation framework
    if (/\b(move|relocat|city|living)\b/i.test(query)) {
      const framework = this.contextualFrameworks[intent.primaryIntent] || '';
      if (framework) {
        contextual = `${contextual} ${framework}`;
      }
    }

    return contextual;
  }

  private optimizeForComparison(
    query: string,
    intent: QueryIntent,
    context?: UserContext,
  ): string {
    let comparative = query;

    // Ensure comparison structure is clear
    if (intent.entities.comparisons.length > 1) {
      const [first, ...rest] = intent.entities.comparisons;
      comparative = `compare ${first.trim()} vs ${rest.join(' vs ').trim()}`;
    }

    // Add comparison context
    if (context?.targetCities?.length && !comparative.includes('vs')) {
      const cities = context.targetCities.slice(0, 3);
      if (cities.length > 1) {
        comparative = `${comparative} comparing ${cities.join(' vs ')}`;
      }
    }

    // Add comparison framework
    comparative = `${comparative} comparison pros and cons`;

    return comparative;
  }

  private applyFinalOptimizations(query: string, intent: QueryIntent): string {
    let optimized = query;

    // Add location specificity if needed
    if (intent.entities.locations.length > 0 && !optimized.includes('city')) {
      optimized = `${optimized} city`;
    }

    // Add temporal specificity
    if (
      intent.confidence.temporalRelevance > 0.7 &&
      !optimized.match(/\b(2024|2025|current|latest|recent)\b/)
    ) {
      optimized = `${optimized} 2025 current`;
    }

    // Ensure query is search-engine friendly
    optimized = optimized.replace(/\s+/g, ' ').trim().substring(0, 200); // Keep under reasonable length

    return optimized;
  }

  private extractSearchTerms(query: string, intent: QueryIntent): string[] {
    // Extract key terms for semantic matching
    const terms = new Set<string>();

    // Add entity terms
    intent.entities.locations.forEach((loc) => terms.add(loc.toLowerCase()));
    intent.entities.topics.forEach((topic) => terms.add(topic.toLowerCase()));

    // Add intent-specific terms
    const intentTerms = this.getIntentSpecificTerms(intent.primaryIntent);
    intentTerms.forEach((term) => terms.add(term));

    // Add query-specific terms (remove stop words)
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 2)
      .filter((term) => !this.isStopWord(term));

    queryTerms.forEach((term) => terms.add(term));

    return Array.from(terms).slice(0, 10); // Top 10 terms
  }

  private getIntentSpecificTerms(
    intent: QueryIntent['primaryIntent'],
  ): string[] {
    const termMap: Record<string, string[]> = {
      factual: ['information', 'facts', 'data'],
      recommendation: ['best', 'top', 'recommended', 'popular'],
      comparison: ['compare', 'vs', 'difference', 'better'],
      status: ['current', 'status', 'available', 'open'],
      planning: ['planning', 'guide', 'advice', 'tips'],
      conversational: ['discussion', 'opinion', 'experience'],
    };

    return termMap[intent] || [];
  }

  private buildContextualInfo(
    intent: QueryIntent,
    context?: UserContext,
  ): string[] {
    const contextInfo: string[] = [];

    if (context?.currentLocation) {
      contextInfo.push(`Current location: ${context.currentLocation}`);
    }

    if (context?.targetCities?.length) {
      contextInfo.push(`Target cities: ${context.targetCities.join(', ')}`);
    }

    if (context?.preferences?.careerField) {
      contextInfo.push(`Career: ${context.preferences.careerField}`);
    }

    if (context?.preferences?.priorities?.length) {
      contextInfo.push(
        `Priorities: ${context.preferences.priorities.join(', ')}`,
      );
    }

    if (intent.searchStrategy.expectedSources.length > 0) {
      contextInfo.push(
        `Expected sources: ${intent.searchStrategy.expectedSources.join(', ')}`,
      );
    }

    return contextInfo;
  }

  private calculateRewriteConfidence(
    original: string,
    rewritten: string,
    intent: QueryIntent,
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on improvements
    if (rewritten.length > original.length * 1.2) confidence += 0.2; // Added context
    if (intent.entities.locations.length > 0) confidence += 0.15; // Location context
    if (intent.confidence.temporalRelevance > 0.6) confidence += 0.15; // Temporal context
    if (rewritten.includes('vs') || rewritten.includes('compare'))
      confidence += 0.1; // Comparison structure

    // Decrease confidence for potential over-expansion
    if (rewritten.length > original.length * 3) confidence -= 0.2; // Too much expansion
    if (rewritten.split(' ').length > 25) confidence -= 0.1; // Too verbose

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private generateRewriteReasoning(
    original: string,
    rewritten: string,
    strategy: RewrittenQuery['strategy'],
    intent: QueryIntent,
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Strategy: ${strategy}`);
    reasoning.push(`Original length: ${original.split(' ').length} words`);
    reasoning.push(`Rewritten length: ${rewritten.split(' ').length} words`);

    if (rewritten.length > original.length) {
      reasoning.push('Added contextual information for better search results');
    }

    if (intent.entities.locations.length > 0) {
      reasoning.push('Enhanced with location-specific terms');
    }

    if (intent.confidence.temporalRelevance > 0.6) {
      reasoning.push('Added temporal context for current information');
    }

    if (strategy === 'comparative') {
      reasoning.push('Optimized for comparison queries');
    }

    return reasoning;
  }

  private getRelevantTimeModifiers(query: string): string[] {
    const modifiers: string[] = [];
    const queryLower = query.toLowerCase();

    if (/\b(now|current|today)\b/.test(queryLower)) {
      modifiers.push(...this.temporalModifiers.immediate);
    }

    if (/\b(recent|latest|this year)\b/.test(queryLower)) {
      modifiers.push(...this.temporalModifiers.recent);
    }

    if (/\b(future|upcoming|will)\b/.test(queryLower)) {
      modifiers.push(...this.temporalModifiers.future);
    }

    return modifiers.slice(0, 3); // Limit to 3 modifiers
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'among',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
    ]);
    return stopWords.has(word.toLowerCase());
  }
}
