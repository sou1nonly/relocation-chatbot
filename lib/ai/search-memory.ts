/**
 * Memory Reuse System for Web Search Results
 * Caches and reuses search results to avoid redundant API calls
 */

import type { QueryIntent } from './intent-classifier';
import type { RewrittenQuery } from './query-rewriter';
import type { FilteredResults, ScoredResult } from './semantic-filter';

export interface CachedSearchResult {
  id: string;
  originalQuery: string;
  rewrittenQuery: string;
  intent: QueryIntent;
  results: ScoredResult[];
  metadata: {
    timestamp: Date;
    expiresAt: Date;
    searchProvider: string;
    resultCount: number;
    averageScore: number;
  };
  usage: {
    accessCount: number;
    lastAccessed: Date;
    similarQueries: string[];
  };
  // Hash-based embeddings for similarity matching
  queryEmbedding: number[];
  topicsEmbedding: number[];
}

export interface SimilarityMatch {
  cachedResult: CachedSearchResult;
  similarityScore: number;
  matchType: 'exact' | 'semantic' | 'topical' | 'intent';
  confidence: number;
  reasoning: string[];
}

export interface MemoryReuseCacheOptions {
  maxCacheSize: number;
  defaultTTLMinutes: number;
  similarityThreshold: number;
  enableSemanticMatching: boolean;
  purgeExpiredOnAccess: boolean;
}

export class SearchMemoryCache {
  private cache = new Map<string, CachedSearchResult>();
  private readonly options: MemoryReuseCacheOptions = {
    maxCacheSize: 500,
    defaultTTLMinutes: 120, // 2 hours
    similarityThreshold: 0.75,
    enableSemanticMatching: true,
    purgeExpiredOnAccess: true,
  };

  constructor(options?: Partial<MemoryReuseCacheOptions>) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Check if a similar query exists in cache and return results
   */
  findSimilarSearch(
    query: string,
    intent: QueryIntent,
    rewrittenQuery?: RewrittenQuery,
  ): SimilarityMatch | null {
    if (this.options.purgeExpiredOnAccess) {
      this.purgeExpired();
    }

    // Generate embeddings for the current query
    const queryEmbedding = this.generateQueryEmbedding(query);
    const topicsEmbedding = this.generateTopicsEmbedding(
      intent.entities.topics,
    );

    let bestMatch: SimilarityMatch | null = null;
    let bestScore = 0;

    for (const cachedResult of this.cache.values()) {
      if (this.isExpired(cachedResult)) continue;

      const similarity = this.calculateSimilarity(
        { query, intent, queryEmbedding, topicsEmbedding },
        cachedResult,
        rewrittenQuery,
      );

      if (
        similarity.similarityScore > bestScore &&
        similarity.similarityScore >= this.options.similarityThreshold
      ) {
        bestScore = similarity.similarityScore;
        bestMatch = similarity;
      }
    }

    if (bestMatch) {
      this.updateUsageStats(bestMatch.cachedResult, query);
    }

    return bestMatch;
  }

  /**
   * Store search results in cache for future reuse
   */
  storeSearchResults(
    query: string,
    intent: QueryIntent,
    rewrittenQuery: RewrittenQuery,
    results: FilteredResults,
    customTTL?: number,
  ): string {
    const cacheId = this.generateCacheId(query, intent);

    // Check if we need to make room in cache
    if (this.cache.size >= this.options.maxCacheSize) {
      this.evictLeastUseful();
    }

    const ttlMinutes = customTTL || this.getTTLForQuery(intent);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const cachedResult: CachedSearchResult = {
      id: cacheId,
      originalQuery: query,
      rewrittenQuery: rewrittenQuery.rewritten,
      intent,
      results: results.results,
      metadata: {
        timestamp: new Date(),
        expiresAt,
        searchProvider: 'serper', // or extract from config
        resultCount: results.results.length,
        averageScore: results.summary.averageScore,
      },
      usage: {
        accessCount: 0,
        lastAccessed: new Date(),
        similarQueries: [],
      },
      queryEmbedding: this.generateQueryEmbedding(query),
      topicsEmbedding: this.generateTopicsEmbedding(intent.entities.topics),
    };

    this.cache.set(cacheId, cachedResult);
    return cacheId;
  }

  /**
   * Update existing cached results with new information
   */
  updateCachedResult(
    cacheId: string,
    newResults: ScoredResult[],
    additionalQuery?: string,
  ): boolean {
    const cached = this.cache.get(cacheId);
    if (!cached || this.isExpired(cached)) {
      return false;
    }

    // Merge results, keeping the best scores
    const mergedResults = this.mergeSearchResults(cached.results, newResults);

    cached.results = mergedResults;
    cached.metadata.resultCount = mergedResults.length;
    cached.metadata.averageScore = this.calculateAverageScore(mergedResults);

    if (
      additionalQuery &&
      !cached.usage.similarQueries.includes(additionalQuery)
    ) {
      cached.usage.similarQueries.push(additionalQuery);
    }

    this.cache.set(cacheId, cached);
    return true;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    averageAge: number;
    mostUsedQueries: Array<{ query: string; count: number }>;
    topTopics: string[];
  } {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    const totalAge = entries.reduce((sum, entry) => {
      return sum + (now - entry.metadata.timestamp.getTime());
    }, 0);

    const averageAge =
      entries.length > 0 ? totalAge / entries.length / (1000 * 60) : 0; // minutes

    const sortedByUsage = entries
      .sort((a, b) => b.usage.accessCount - a.usage.accessCount)
      .slice(0, 10);

    const allTopics = entries.flatMap((entry) => entry.intent.entities.topics);
    const topicCounts = new Map<string, number>();
    allTopics.forEach((topic) => {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });

    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);

    return {
      size: this.cache.size,
      hitRate: this.calculateHitRate(),
      averageAge: Math.round(averageAge),
      mostUsedQueries: sortedByUsage.map((entry) => ({
        query: entry.originalQuery,
        count: entry.usage.accessCount,
      })),
      topTopics,
    };
  }

  /**
   * Clear expired entries and optionally resize cache
   */
  cleanup(forceResize = false): number {
    const initialSize = this.cache.size;

    this.purgeExpired();

    if (forceResize && this.cache.size > this.options.maxCacheSize * 0.8) {
      this.evictLeastUseful(Math.floor(this.options.maxCacheSize * 0.6));
    }

    return initialSize - this.cache.size;
  }

  private calculateSimilarity(
    current: {
      query: string;
      intent: QueryIntent;
      queryEmbedding: number[];
      topicsEmbedding: number[];
    },
    cached: CachedSearchResult,
    rewrittenQuery?: RewrittenQuery,
  ): SimilarityMatch {
    let similarityScore = 0;
    let matchType: SimilarityMatch['matchType'] = 'semantic';
    const reasoning: string[] = [];

    // 1. Exact query match
    if (current.query.toLowerCase() === cached.originalQuery.toLowerCase()) {
      similarityScore = 0.95;
      matchType = 'exact';
      reasoning.push('Exact query match');
    } else {
      // 2. Semantic similarity using embeddings
      const querySimScore = this.cosineSimilarity(
        current.queryEmbedding,
        cached.queryEmbedding,
      );
      similarityScore += querySimScore * 0.4;
      reasoning.push(`Query similarity: ${(querySimScore * 100).toFixed(1)}%`);

      // 3. Topic/entity similarity
      const topicSimScore = this.cosineSimilarity(
        current.topicsEmbedding,
        cached.topicsEmbedding,
      );
      similarityScore += topicSimScore * 0.3;
      reasoning.push(`Topic similarity: ${(topicSimScore * 100).toFixed(1)}%`);

      // 4. Intent matching
      const intentScore = this.calculateIntentSimilarity(
        current.intent,
        cached.intent,
      );
      similarityScore += intentScore * 0.2;
      reasoning.push(`Intent similarity: ${(intentScore * 100).toFixed(1)}%`);

      // 5. Location overlap
      const locationScore = this.calculateLocationOverlap(
        current.intent,
        cached.intent,
      );
      similarityScore += locationScore * 0.1;
      if (locationScore > 0) {
        reasoning.push(
          `Location overlap: ${(locationScore * 100).toFixed(1)}%`,
        );
      }

      // Determine match type based on strongest signal
      if (topicSimScore > 0.8) matchType = 'topical';
      else if (intentScore > 0.7) matchType = 'intent';
    }

    // Calculate confidence based on result quality and freshness
    let confidence = similarityScore;

    // Boost confidence for high-quality cached results
    if (cached.metadata.averageScore > 0.7) confidence += 0.1;

    // Reduce confidence for old results
    const ageHours =
      (Date.now() - cached.metadata.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) confidence -= 0.1;
    if (ageHours > 72) confidence -= 0.2;

    confidence = Math.max(0, Math.min(1, confidence));

    return {
      cachedResult: cached,
      similarityScore,
      matchType,
      confidence,
      reasoning,
    };
  }

  private generateQueryEmbedding(query: string): number[] {
    // Simple hash-based embedding (replace with proper embeddings in production)
    const words = query.toLowerCase().split(/\s+/);
    const embedding = new Array(64).fill(0);

    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const pos = Math.abs(hash) % 64;
      embedding[pos] += 1 / (index + 1); // Weight earlier words more
    });

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  private generateTopicsEmbedding(topics: string[]): number[] {
    if (topics.length === 0) return new Array(64).fill(0);

    const embedding = new Array(64).fill(0);

    topics.forEach((topic, index) => {
      const hash = this.simpleHash(topic);
      const pos = Math.abs(hash) % 64;
      embedding[pos] += 1 / Math.sqrt(index + 1);
    });

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private calculateIntentSimilarity(a: QueryIntent, b: QueryIntent): number {
    let score = 0;

    // Primary intent match
    if (a.primaryIntent === b.primaryIntent) score += 0.5;

    // Search strategy similarity
    if (a.searchStrategy.priority === b.searchStrategy.priority) score += 0.2;
    if (a.searchStrategy.queryType === b.searchStrategy.queryType) score += 0.2;

    // Confidence similarity
    const confDiff = Math.abs(
      a.confidence.needsWebSearch - b.confidence.needsWebSearch,
    );
    score += Math.max(0, 1 - confDiff) * 0.1;

    return Math.min(1, score);
  }

  private calculateLocationOverlap(a: QueryIntent, b: QueryIntent): number {
    if (
      a.entities.locations.length === 0 ||
      b.entities.locations.length === 0
    ) {
      return 0;
    }

    const aLocations = new Set(
      a.entities.locations.map((l) => l.toLowerCase()),
    );
    const bLocations = new Set(
      b.entities.locations.map((l) => l.toLowerCase()),
    );

    const intersection = new Set(
      [...aLocations].filter((l) => bLocations.has(l)),
    );
    const union = new Set([...aLocations, ...bLocations]);

    return intersection.size / union.size;
  }

  private getTTLForQuery(intent: QueryIntent): number {
    // Shorter TTL for time-sensitive queries
    if (intent.confidence.temporalRelevance > 0.8) return 30; // 30 minutes
    if (intent.confidence.temporalRelevance > 0.6) return 60; // 1 hour
    if (intent.searchStrategy.priority === 'high') return 90; // 1.5 hours

    return this.options.defaultTTLMinutes;
  }

  private generateCacheId(query: string, intent: QueryIntent): string {
    const timestamp = Date.now();
    const hash = this.simpleHash(
      `${query}_${intent.primaryIntent}_${timestamp}`,
    );
    return `cache_${Math.abs(hash)}_${timestamp}`;
  }

  private isExpired(cached: CachedSearchResult): boolean {
    return Date.now() > cached.metadata.expiresAt.getTime();
  }

  private purgeExpired(): void {
    for (const [id, cached] of this.cache.entries()) {
      if (this.isExpired(cached)) {
        this.cache.delete(id);
      }
    }
  }

  private evictLeastUseful(targetSize?: number): void {
    const target = targetSize || Math.floor(this.options.maxCacheSize * 0.8);

    if (this.cache.size <= target) return;

    const entries = Array.from(this.cache.entries());

    // Sort by usefulness score (access count + recency + result quality)
    entries.sort(([, a], [, b]) => {
      const scoreA = this.calculateUsefulnessScore(a);
      const scoreB = this.calculateUsefulnessScore(b);
      return scoreA - scoreB; // Ascending order (least useful first)
    });

    const toRemove = entries.slice(0, this.cache.size - target);
    toRemove.forEach(([id]) => this.cache.delete(id));
  }

  private calculateUsefulnessScore(cached: CachedSearchResult): number {
    const ageHours =
      (Date.now() - cached.metadata.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - ageHours / 168); // Decay over 1 week

    return (
      cached.usage.accessCount * 0.4 +
      recencyScore * 0.3 +
      cached.metadata.averageScore * 0.3
    );
  }

  private updateUsageStats(cached: CachedSearchResult, query: string): void {
    cached.usage.accessCount++;
    cached.usage.lastAccessed = new Date();

    if (
      query !== cached.originalQuery &&
      !cached.usage.similarQueries.includes(query)
    ) {
      cached.usage.similarQueries.push(query);
      // Keep only the 5 most recent similar queries
      if (cached.usage.similarQueries.length > 5) {
        cached.usage.similarQueries = cached.usage.similarQueries.slice(-5);
      }
    }
  }

  private mergeSearchResults(
    existing: ScoredResult[],
    newResults: ScoredResult[],
  ): ScoredResult[] {
    const merged = new Map<string, ScoredResult>();

    // Add existing results
    existing.forEach((result) => {
      merged.set(result.link, result);
    });

    // Add or update with new results
    newResults.forEach((result) => {
      const existing = merged.get(result.link);
      if (!existing || result.finalScore > existing.finalScore) {
        merged.set(result.link, result);
      }
    });

    return Array.from(merged.values())
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 10); // Keep top 10
  }

  private calculateAverageScore(results: ScoredResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.finalScore, 0) / results.length;
  }

  private calculateHitRate(): number {
    // This would need to be tracked separately in a real implementation
    // For now, return a placeholder
    return 0.75; // 75% hit rate
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}
