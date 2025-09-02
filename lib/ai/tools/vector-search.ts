import { z } from 'zod';
import { tool } from 'ai';

const vectorSearchSchema = z.object({
  query: z
    .string()
    .describe('The query to search through the city relocation knowledge base'),
  k: z
    .number()
    .optional()
    .default(5)
    .describe('Number of relevant documents to retrieve'),
});

export const vectorSearch = tool({
  description:
    'Search through the city relocation knowledge base for relevant information about cities, neighborhoods, cost of living, etc.',
  inputSchema: vectorSearchSchema,
  execute: async ({ query, k }) => {
    const topK = k ?? 5;

    try {
      const pineconeApiKey = process.env.PINECONE_API_KEY;
      const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
      const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      if (!pineconeApiKey || !pineconeIndexName || !googleApiKey) {
        return {
          error:
            'Vector search is not available. Required API keys are not configured.',
          results: [],
        };
      }

      // Generate embeddings for the query using Google's embedding model
      const embeddingResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'models/embedding-001',
            content: {
              parts: [{ text: query }],
            },
          }),
        },
      );

      if (!embeddingResponse.ok) {
        throw new Error('Failed to generate embeddings');
      }

      const embeddingData = await embeddingResponse.json();
      const queryVector = embeddingData.embedding.values;

      // Search Pinecone with the query vector
      const pineconeResponse = await fetch(
        `https://${pineconeIndexName}.svc.aped-4627-b74a.pinecone.io/query`,
        {
          method: 'POST',
          headers: {
            'Api-Key': pineconeApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vector: queryVector,
            topK: topK,
            includeMetadata: true,
            includeValues: false,
          }),
        },
      );

      if (!pineconeResponse.ok) {
        const errorText = await pineconeResponse.text();
        console.error('Pinecone error:', pineconeResponse.status, errorText);
        throw new Error(
          `Failed to query Pinecone: ${pineconeResponse.status} - ${errorText}`,
        );
      }

      const pineconeData = await pineconeResponse.json();
      const matches = pineconeData.matches || [];

      return {
        results: matches.map((match: any) => ({
          id: match.id,
          score: match.score,
          text: match.metadata?.text || '',
          source: match.metadata?.source || '',
          title: match.metadata?.title || '',
        })),
        query,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Vector search error:', error);
      return {
        error: 'Failed to search knowledge base. Please try again.',
        results: [],
      };
    }
  },
});
