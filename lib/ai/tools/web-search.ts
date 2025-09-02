import { z } from 'zod';
import { tool } from 'ai';

const webSearchSchema = z.object({
  query: z.string().describe('The search query to find current information'),
  context: z
    .string()
    .optional()
    .describe(
      "Additional context about the user's preferences for better search results",
    ),
});

export const webSearch = tool({
  description:
    'Search the web for current information about cities, news, weather, or recent updates',
  inputSchema: webSearchSchema,
  execute: async ({ query, context }) => {
    try {
      const serperApiKey = process.env.SERPER_API_KEY;

      if (!serperApiKey) {
        return {
          error:
            'Web search is not available. SERPER_API_KEY is not configured.',
          results: [],
        };
      }

      // Enhance query with context if provided
      const enhancedQuery = context ? `${context} ${query}` : query;

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: enhancedQuery,
          num: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const results = data.organic || [];

      return {
        results: results.slice(0, 5).map((item: any) => ({
          title: item.title || '',
          snippet: item.snippet || '',
          link: item.link || '',
          position: item.position || 0,
        })),
        searchQuery: enhancedQuery,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Web search error:', error);
      return {
        error: 'Failed to fetch web search results. Please try again.',
        results: [],
      };
    }
  },
});
