/**
 * Semantic Result Filtering and Ranking System
 * Uses embeddings-based similarity to filter and rank web search results
 */

import type { QueryIntent } from './intent-classifier';
import type { RewrittenQuery } from './query-rewriter';

export interface WebSearchResult {
  title: string;
  snippet: string;
  link: string;
  position: number;
  // Additional metadata
  domain?: string;
  publishDate?: string;
  sourceType?:
    | 'news'
    | 'official'
    | 'review'
    | 'social'
    | 'commercial'
    | 'general';
}

export interface ScoredResult extends WebSearchResult {
  relevanceScore: number;
  semanticScore: number;
  contextScore: number;
  qualityScore: number;
  finalScore: number;
  reasoning: string[];
}

export interface FilteredResults {
  results: ScoredResult[];
  summary: {
    totalProcessed: number;
    totalFiltered: number;
    averageScore: number;
    topScoreType: string;
    weakResults: boolean;
  };
  suggestions: {
    needsRefinement: boolean;
    suggestedQueries: string[];
    missingContext: string[];
  };
}

export class SemanticResultFilter {
  private readonly domainAuthority: Record<string, number> = {
    // High authority sources
    gov: 0.95,
    edu: 0.9,
    org: 0.8,

    // News sources
    'cnn.com': 0.85,
    'bbc.com': 0.85,
    'reuters.com': 0.85,
    'ap.org': 0.85,

    // Local sources
    'yelp.com': 0.7,
    'tripadvisor.com': 0.7,
    'foursquare.com': 0.65,

    // Real estate
    'zillow.com': 0.8,
    'realtor.com': 0.8,
    'apartments.com': 0.75,

    // Job sites
    'linkedin.com': 0.85,
    'indeed.com': 0.8,
    'glassdoor.com': 0.8,

    // General
    'wikipedia.org': 0.75,
    'reddit.com': 0.6,
    'quora.com': 0.55,
  };

  private readonly sourceTypeWeights: Record<string, number> = {
    news: 0.9,
    official: 1.0,
    review: 0.8,
    social: 0.6,
    commercial: 0.7,
    general: 0.75,
  };

  /**
   * Filter and rank web search results using semantic analysis
   */
  filterAndRankResults(
    rawResults: WebSearchResult[],
    intent: QueryIntent,
    rewrittenQuery: RewrittenQuery,
    minQualityThreshold = 0.3,
  ): FilteredResults {
    // Enrich results with metadata
    const enrichedResults = this.enrichResultsWithMetadata(rawResults);

    // Score all results
    const scoredResults = enrichedResults.map((result) =>
      this.scoreResult(result, intent, rewrittenQuery),
    );

    // Filter by minimum quality
    const filteredResults = scoredResults.filter(
      (result) => result.finalScore >= minQualityThreshold,
    );

    // Sort by final score
    filteredResults.sort((a, b) => b.finalScore - a.finalScore);

    // Generate summary and suggestions
    const summary = this.generateResultsSummary(scoredResults, filteredResults);
    const suggestions = this.generateSuggestions(
      filteredResults,
      intent,
      rewrittenQuery,
    );

    return {
      results: filteredResults.slice(0, 8), // Top 8 results
      summary,
      suggestions,
    };
  }

  private enrichResultsWithMetadata(
    results: WebSearchResult[],
  ): WebSearchResult[] {
    return results.map((result) => ({
      ...result,
      domain: this.extractDomain(result.link),
      sourceType: this.classifySourceType(result),
      publishDate: this.extractPublishDate(result.snippet),
    }));
  }

  private scoreResult(
    result: WebSearchResult,
    intent: QueryIntent,
    rewrittenQuery: RewrittenQuery,
  ): ScoredResult {
    const relevanceScore = this.calculateRelevanceScore(result, rewrittenQuery);
    const semanticScore = this.calculateSemanticScore(result, intent);
    const contextScore = this.calculateContextScore(result, intent);
    const qualityScore = this.calculateQualityScore(result);

    // Weighted combination
    const weights = this.getScoreWeights(intent);
    const finalScore =
      (relevanceScore * weights.relevance +
        semanticScore * weights.semantic +
        contextScore * weights.context +
        qualityScore * weights.quality) /
      (weights.relevance +
        weights.semantic +
        weights.context +
        weights.quality);

    const reasoning = this.generateScoreReasoning(
      result,
      relevanceScore,
      semanticScore,
      contextScore,
      qualityScore,
    );

    return {
      ...result,
      relevanceScore,
      semanticScore,
      contextScore,
      qualityScore,
      finalScore,
      reasoning,
    };
  }

  private calculateRelevanceScore(
    result: WebSearchResult,
    query: RewrittenQuery,
  ): number {
    let score = 0;

    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    const originalLower = query.original.toLowerCase();
    const rewrittenLower = query.rewritten.toLowerCase();

    // Direct term matches in title (high weight)
    query.searchTerms.forEach((term) => {
      if (titleLower.includes(term)) score += 0.15;
      if (snippetLower.includes(term)) score += 0.08;
    });

    // Original query matches
    const originalWords = originalLower
      .split(/\s+/)
      .filter((word) => word.length > 2);
    originalWords.forEach((word) => {
      if (titleLower.includes(word)) score += 0.1;
      if (snippetLower.includes(word)) score += 0.05;
    });

    // Rewritten query matches (moderate weight)
    const rewrittenWords = rewrittenLower
      .split(/\s+/)
      .filter((word) => word.length > 2);
    rewrittenWords.forEach((word) => {
      if (titleLower.includes(word)) score += 0.08;
      if (snippetLower.includes(word)) score += 0.04;
    });

    // Position bonus (earlier results get slight boost)
    const positionBonus = Math.max(0, (10 - result.position) / 100);
    score += positionBonus;

    return Math.min(1.0, score);
  }

  private calculateSemanticScore(
    result: WebSearchResult,
    intent: QueryIntent,
  ): number {
    let score = 0;

    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet.toLowerCase();
    const combinedText = `${titleLower} ${snippetLower}`;

    // Intent-specific semantic indicators
    switch (intent.primaryIntent) {
      case 'factual':
        if (
          /\b(data|statistics|facts|information|report|study)\b/.test(
            combinedText,
          )
        )
          score += 0.3;
        break;

      case 'recommendation':
        if (
          /\b(best|top|recommended|guide|review|rating|popular)\b/.test(
            combinedText,
          )
        )
          score += 0.3;
        break;

      case 'comparison':
        if (
          /\b(vs|versus|compare|comparison|difference|better|pros|cons)\b/.test(
            combinedText,
          )
        )
          score += 0.3;
        break;

      case 'status':
        if (
          /\b(current|now|today|available|open|closed|status|update)\b/.test(
            combinedText,
          )
        )
          score += 0.3;
        break;

      case 'planning':
        if (
          /\b(guide|tips|advice|planning|how to|checklist|prepare)\b/.test(
            combinedText,
          )
        )
          score += 0.3;
        break;
    }

    // Location relevance
    if (intent.confidence.locationRelevance > 0.6) {
      intent.entities.locations.forEach((location) => {
        if (combinedText.includes(location.toLowerCase())) {
          score += 0.2;
        }
      });
    }

    // Temporal relevance
    if (intent.confidence.temporalRelevance > 0.6) {
      if (
        /\b(2024|2025|current|recent|latest|now|today)\b/.test(combinedText)
      ) {
        score += 0.2;
      }
    }

    // Topic alignment
    let topicMatches = 0;
    intent.entities.topics.forEach((topic) => {
      if (combinedText.includes(topic)) {
        topicMatches++;
      }
    });
    score += Math.min(0.3, topicMatches * 0.1);

    return Math.min(1.0, score);
  }

  private calculateContextScore(
    result: WebSearchResult,
    intent: QueryIntent,
  ): number {
    let score = 0.5; // Base score

    // Source type alignment with intent
    const sourceType = result.sourceType || 'general';
    const expectedSources = intent.searchStrategy.expectedSources;

    if (expectedSources.includes(sourceType)) {
      score += 0.3;
    }

    // Content freshness for time-sensitive queries
    if (intent.confidence.temporalRelevance > 0.7) {
      if (result.publishDate) {
        const publishAge = this.calculateContentAge(result.publishDate);
        if (publishAge <= 30)
          score += 0.2; // Within 30 days
        else if (publishAge <= 90) score += 0.1; // Within 3 months
      }
    }

    // Location context
    if (intent.confidence.locationRelevance > 0.6) {
      // Check if result contains location-specific information
      if (this.hasLocationContext(result, intent.entities.locations)) {
        score += 0.2;
      }
    }

    return Math.min(1.0, score);
  }

  private calculateQualityScore(result: WebSearchResult): number {
    let score = 0.5; // Base quality score

    // Domain authority
    const domain = result.domain || this.extractDomain(result.link);
    const authority = this.getDomainAuthority(domain);
    score += authority * 0.3;

    // Source type quality
    const sourceType = result.sourceType || 'general';
    const typeWeight = this.sourceTypeWeights[sourceType] || 0.75;
    score += (typeWeight - 0.5) * 0.4;

    // Content quality indicators
    const titleLength = result.title.length;
    const snippetLength = result.snippet.length;

    // Penalize very short or very long content
    if (titleLength < 20 || titleLength > 120) score -= 0.1;
    if (snippetLength < 50 || snippetLength > 300) score -= 0.1;

    // Bonus for well-structured content
    if (/[.!?]\s/.test(result.snippet)) score += 0.1; // Has sentence structure
    if (/\b(and|or|but|also|however|therefore)\b/i.test(result.snippet))
      score += 0.05; // Connective words

    // Penalty for spam indicators
    if (
      /\b(click here|free|best deal|amazing|unbelievable)\b/i.test(result.title)
    )
      score -= 0.2;
    if (
      result.snippet.includes('...') &&
      result.snippet.split('...').length > 3
    )
      score -= 0.1;

    return Math.max(0.1, Math.min(1.0, score));
  }

  private getScoreWeights(intent: QueryIntent): Record<string, number> {
    const baseWeights = {
      relevance: 0.4,
      semantic: 0.3,
      context: 0.2,
      quality: 0.1,
    };

    // Adjust weights based on intent
    switch (intent.searchStrategy.priority) {
      case 'high':
        return { relevance: 0.3, semantic: 0.35, context: 0.25, quality: 0.1 };
      case 'medium':
        return { relevance: 0.35, semantic: 0.3, context: 0.25, quality: 0.1 };
      case 'low':
        return { relevance: 0.5, semantic: 0.2, context: 0.2, quality: 0.1 };
      default:
        return baseWeights;
    }
  }

  private generateResultsSummary(
    allResults: ScoredResult[],
    filteredResults: ScoredResult[],
  ): FilteredResults['summary'] {
    const averageScore =
      filteredResults.length > 0
        ? filteredResults.reduce((sum, r) => sum + r.finalScore, 0) /
          filteredResults.length
        : 0;

    const topScoreType = filteredResults[0]?.sourceType || 'general';
    const weakResults = averageScore < 0.5 || filteredResults.length < 3;

    return {
      totalProcessed: allResults.length,
      totalFiltered: filteredResults.length,
      averageScore,
      topScoreType,
      weakResults,
    };
  }

  private generateSuggestions(
    results: ScoredResult[],
    intent: QueryIntent,
    query: RewrittenQuery,
  ): FilteredResults['suggestions'] {
    const needsRefinement = results.length < 3 || results[0]?.finalScore < 0.6;
    const suggestedQueries: string[] = [];
    const missingContext: string[] = [];

    if (needsRefinement) {
      // Suggest more specific queries
      if (intent.entities.locations.length === 0) {
        missingContext.push('specific location or city name');
        suggestedQueries.push(`${query.original} [specific city]`);
      }

      if (intent.confidence.temporalRelevance < 0.3) {
        missingContext.push('time frame (current, recent, 2025)');
        suggestedQueries.push(`${query.original} 2025 current`);
      }

      // Suggest broader queries if too specific
      if (query.searchTerms.length > 8) {
        suggestedQueries.push(query.original.split(' ').slice(0, 5).join(' '));
      }

      // Suggest alternative phrasings
      if (intent.primaryIntent === 'recommendation') {
        suggestedQueries.push(
          `best ${query.original.replace(/best|good|recommend/gi, '').trim()}`,
        );
      }
    }

    return {
      needsRefinement,
      suggestedQueries: suggestedQueries.slice(0, 3),
      missingContext: missingContext.slice(0, 3),
    };
  }

  private generateScoreReasoning(
    result: WebSearchResult,
    relevance: number,
    semantic: number,
    context: number,
    quality: number,
  ): string[] {
    const reasoning: string[] = [];

    if (relevance > 0.7) reasoning.push('High relevance to query terms');
    else if (relevance < 0.3) reasoning.push('Low relevance to query terms');

    if (semantic > 0.6) reasoning.push('Strong semantic alignment with intent');
    else if (semantic < 0.3) reasoning.push('Weak semantic alignment');

    if (context > 0.7) reasoning.push('Good contextual fit');
    if (quality > 0.8) reasoning.push('High-quality source');
    else if (quality < 0.4) reasoning.push('Lower-quality source');

    if (result.sourceType) reasoning.push(`Source type: ${result.sourceType}`);
    if (result.domain) reasoning.push(`Domain: ${result.domain}`);

    return reasoning;
  }

  // Helper methods
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private classifySourceType(
    result: WebSearchResult,
  ): WebSearchResult['sourceType'] {
    const domain = this.extractDomain(result.link);
    const titleLower = result.title.toLowerCase();

    if (domain.endsWith('.gov')) return 'official';
    if (domain.endsWith('.edu')) return 'official';
    if (/news|breaking|report/.test(titleLower)) return 'news';
    if (/review|rating|opinion/.test(titleLower)) return 'review';
    if (/reddit|twitter|facebook|social/.test(domain)) return 'social';
    if (/shop|buy|price|deal/.test(titleLower)) return 'commercial';

    return 'general';
  }

  private extractPublishDate(snippet: string): string | undefined {
    // Simple date extraction from snippet
    const dateMatch = snippet.match(
      /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]+ \d{1,2}, \d{4})/,
    );
    return dateMatch ? dateMatch[0] : undefined;
  }

  private getDomainAuthority(domain: string): number {
    // Check exact match first
    if (this.domainAuthority[domain]) {
      return this.domainAuthority[domain];
    }

    // Check domain patterns
    if (domain.endsWith('.gov')) return 0.95;
    if (domain.endsWith('.edu')) return 0.9;
    if (domain.endsWith('.org')) return 0.8;

    return 0.5; // Default authority
  }

  private calculateContentAge(publishDate: string): number {
    try {
      const date = new Date(publishDate);
      const now = new Date();
      return Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
      );
    } catch {
      return 365; // Default to 1 year old if can't parse
    }
  }

  private hasLocationContext(
    result: WebSearchResult,
    locations: string[],
  ): boolean {
    const combinedText = `${result.title} ${result.snippet}`.toLowerCase();
    return locations.some((location) =>
      combinedText.includes(location.toLowerCase()),
    );
  }
}
