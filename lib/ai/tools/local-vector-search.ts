import { z } from 'zod';
import { tool } from 'ai';
import { searchSimilarContent } from '../local-vector-search';

const localVectorSearchSchema = z.object({
  query: z
    .string()
    .describe('The query to search through the local city knowledge base'),
  limit: z
    .number()
    .optional()
    .default(5)
    .describe('Number of relevant documents to retrieve'),
});

export const localVectorSearch = tool({
  description:
    'Search through the local city knowledge base for relevant information about cities, neighborhoods, cost of living, and relocation advice',
  inputSchema: localVectorSearchSchema,
  execute: async ({ query, limit = 5 }) => {
    try {
      const results = await searchSimilarContent(query, limit);

      return {
        results: results.map((result) => ({
          content: result.content,
          metadata: result.metadata,
          similarity: result.similarity,
        })),
        query,
        timestamp: new Date().toISOString(),
        source: 'local-knowledge-base',
      };
    } catch (error) {
      console.error('Local vector search error:', error);
      return {
        error: 'Failed to search local knowledge base. Please try again.',
        results: [],
      };
    }
  },
});
