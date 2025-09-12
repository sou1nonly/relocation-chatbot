/**
 * Enhanced Web Search Tool with Intelligence Layer
 * Integrates intent detection, query rewriting, semantic filtering, and memory reuse
 */

import { z } from 'zod';
import { tool } from 'ai';
import {
  IntentClassifier,
  type UserContext,
  type QueryIntent,
} from '../intent-classifier';
import { QueryRewriter } from '../query-rewriter';
import { SemanticResultFilter, type WebSearchResult } from '../semantic-filter';
import { SearchMemoryCache } from '../search-memory';

// Initialize the enhanced components
const intentClassifier = new IntentClassifier();
const queryRewriter = new QueryRewriter();
const semanticFilter = new SemanticResultFilter();
const searchMemory = new SearchMemoryCache({
  maxCacheSize: 200,
  defaultTTLMinutes: 90,
  similarityThreshold: 0.7,
});

// Enhanced search helper functions
async function performWebSearch(
  query: string,
): Promise<{ success: boolean; results?: WebSearchResult[]; error?: string }> {
  const serperApiKey = process.env.SERPER_API_KEY;

  if (!serperApiKey) {
    return {
      success: false,
      error: 'Web search is not available. SERPER_API_KEY is not configured.',
    };
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 10, // Get more results for better filtering
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const results = (data.organic || []).map((item: any) => ({
      title: item.title || '',
      snippet: item.snippet || '',
      link: item.link || '',
      position: item.position || 0,
    })) as WebSearchResult[];

    return { success: true, results };
  } catch (error) {
    return {
      success: false,
      error: `Web search API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function processAndFilterResults(
  rawResults: WebSearchResult[],
  intent: QueryIntent,
  originalQuery: string,
) {
  // Create a mock rewritten query for cached results
  const mockRewrittenQuery = {
    original: originalQuery,
    rewritten: originalQuery,
    searchTerms: originalQuery.split(' '),
    context: [],
    strategy: 'direct' as const,
    confidence: 0.8,
    reasoning: ['Using cached results'],
  };

  return semanticFilter.filterAndRankResults(
    rawResults,
    intent,
    mockRewrittenQuery,
  );
}

// Enhanced web search tool with intelligence layer
export const enhancedWebSearch = tool({
  description:
    'Intelligent web search that analyzes intent, rewrites queries for optimal results, and filters results semantically. Includes memory reuse to avoid redundant searches.',
  inputSchema: z.object({
    query: z.string().describe('The user query to search for'),
    includeReasoning: z
      .boolean()
      .optional()
      .describe('Include AI reasoning in response'),
    forceRefresh: z
      .boolean()
      .optional()
      .describe('Bypass cache and force new search'),
    maxResults: z
      .number()
      .optional()
      .describe('Maximum number of results to return (default: 5)'),
  }),
  execute: async ({
    query,
    includeReasoning = false,
    forceRefresh = false,
    maxResults = 5,
  }) => {
    const startTime = Date.now();

    try {
      // Step 1: Intent Classification
      const intent = intentClassifier.classifyIntent(query);

      // Check if web search is actually needed
      if (intent.searchStrategy.priority === 'skip') {
        return {
          message:
            "This query doesn't require web search based on intent analysis.",
          intent: includeReasoning ? intent : undefined,
          searchSkipped: true,
          reasoning: intent.reasoning,
        };
      }

      // Step 2: Check Memory Cache (unless force refresh)
      if (!forceRefresh) {
        const cachedMatch = searchMemory.findSimilarSearch(query, intent);

        if (cachedMatch && cachedMatch.confidence > 0.75) {
          const processedResults = await processAndFilterResults(
            cachedMatch.cachedResult.results.map((r) => ({
              ...r,
              position: r.position || 0,
              domain: r.domain,
              sourceType: r.sourceType,
            })) as WebSearchResult[],
            intent,
            query,
          );

          return {
            results: processedResults.results.slice(0, maxResults),
            searchQuery: query,
            fromCache: true,
            cacheMatch: includeReasoning ? cachedMatch : undefined,
            intent: includeReasoning ? intent : undefined,
            processingTime: Date.now() - startTime,
            summary: processedResults.summary,
          };
        }
      }

      // Step 3: Query Rewriting
      const rewrittenQuery = queryRewriter.rewriteQuery(query, intent);

      // Step 4: Execute Web Search
      const rawResults = await performWebSearch(rewrittenQuery.rewritten);

      if (!rawResults.success) {
        return {
          error: rawResults.error,
          intent: includeReasoning ? intent : undefined,
          rewrittenQuery: includeReasoning ? rewrittenQuery : undefined,
        };
      }

      // Step 5: Semantic Filtering and Ranking
      const filteredResults = semanticFilter.filterAndRankResults(
        rawResults.results || [],
        intent,
        rewrittenQuery,
        0.25, // Lower threshold for better coverage
      );

      // Step 6: Store in Cache
      const cacheId = searchMemory.storeSearchResults(
        query,
        intent,
        rewrittenQuery,
        filteredResults,
      );

      // Step 7: Handle Result Quality
      const results = filteredResults.results.slice(0, maxResults);
      const isWeakResults =
        filteredResults.summary.weakResults || results.length < 3;

      return {
        results,
        searchQuery: rewrittenQuery.rewritten,
        originalQuery: query,
        fromCache: false,
        cacheId,
        intent: includeReasoning ? intent : undefined,
        rewrittenQuery: includeReasoning ? rewrittenQuery : undefined,
        processingTime: Date.now() - startTime,
        summary: filteredResults.summary,
        suggestions: filteredResults.suggestions,
        warning: isWeakResults
          ? 'Search results have moderate confidence. Consider refining your query for better results.'
          : undefined,
        quality: isWeakResults ? 'moderate' : 'high',
      };
    } catch (error) {
      console.error('Enhanced web search error:', error);
      return {
        error: 'Enhanced web search failed. Please try again.',
        originalQuery: query,
        processingTime: Date.now() - startTime,
      };
    }
  },
});

// Export cache management functions
export const webSearchCache = {
  getStats: () => searchMemory.getCacheStats(),
  cleanup: (forceResize = false) => searchMemory.cleanup(forceResize),

  // Helper to check if a query would hit cache
  wouldHitCache: (query: string, userContext?: UserContext) => {
    const intent = intentClassifier.classifyIntent(query, userContext);
    const match = searchMemory.findSimilarSearch(query, intent);
    return {
      wouldHit: match !== null,
      confidence: match?.confidence || 0,
      matchType: match?.matchType || null,
    };
  },
};

// Legacy web search tool for backward compatibility
export const webSearch = tool({
  description:
    'Search the web for current information about cities, news, weather, or recent updates',
  inputSchema: z.object({
    query: z.string().describe('The search query to find current information'),
    context: z
      .string()
      .optional()
      .describe(
        "Additional context about the user's preferences for better search results",
      ),
  }),
  execute: async ({ query, context }) => {
    try {
      // Simple intent classification for legacy compatibility
      const intent = intentClassifier.classifyIntent(query);

      // Check if we should skip search
      if (intent.searchStrategy.priority === 'skip') {
        return {
          results: [],
          message: 'No web search needed for this query',
          searchQuery: query,
          timestamp: new Date().toISOString(),
        };
      }

      // Check cache first
      const cachedMatch = searchMemory.findSimilarSearch(query, intent);

      if (cachedMatch && cachedMatch.confidence > 0.7) {
        return {
          results: cachedMatch.cachedResult.results.slice(0, 5).map((r) => ({
            title: r.title,
            snippet: r.snippet,
            link: r.link,
            position: r.position || 0,
          })),
          searchQuery: query,
          timestamp: new Date().toISOString(),
          fromCache: true,
        };
      }

      // Perform web search
      const enhancedQuery = context ? `${context} ${query}` : query;
      const rawResults = await performWebSearch(enhancedQuery);

      if (!rawResults.success) {
        return {
          error: rawResults.error || 'Search failed',
          results: [],
        };
      }

      // Simple filtering for legacy compatibility
      const results = (rawResults.results || [])
        .slice(0, 5)
        .map((item: any) => ({
          title: item.title || '',
          snippet: item.snippet || '',
          link: item.link || '',
          position: item.position || 0,
        }));

      return {
        results,
        searchQuery: enhancedQuery,
        timestamp: new Date().toISOString(),
        fromCache: false,
      };
    } catch (error) {
      console.error('Legacy web search error:', error);
      return {
        error: 'Failed to fetch web search results. Please try again.',
        results: [],
      };
    }
  },
});
