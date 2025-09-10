/**
 * Local Vector Search - Replaces expensive Pinecone with PostgreSQL
 * Uses simple embedding generation and cosine similarity for semantic search
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cityKnowledge } from '@/lib/db/schema';

const client = postgres(process.env.POSTGRES_URL || '');
const db = drizzle(client);

// Simple hash-based embedding generation to avoid AI API costs
function generateSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(384).fill(0);

  // Create features from words
  words.forEach((word) => {
    const hash = simpleHash(word);
    const position = Math.abs(hash) % 384;
    embedding[position] += 1;
  });

  // Add bigram features for better semantic understanding
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]}_${words[i + 1]}`;
    const hash = simpleHash(bigram);
    const position = Math.abs(hash) % 384;
    embedding[position] += 0.5;
  }

  // Normalize the vector
  const magnitude = Math.sqrt(
    embedding.reduce((sum, val) => sum + val * val, 0),
  );
  if (magnitude > 0) {
    return embedding.map((val) => val / magnitude);
  }

  return embedding;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

// Cosine similarity calculation
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Search similar content using local embeddings
export async function searchSimilarContent(
  query: string,
  limit = 5,
): Promise<Array<{ content: string; metadata: any; similarity: number }>> {
  try {
    const queryEmbedding = generateSimpleEmbedding(query);

    // Get all knowledge entries
    const allKnowledge = await db.select().from(cityKnowledge);

    if (allKnowledge.length === 0) {
      // Initialize if empty
      await initializeKnowledgeBase();
      const newKnowledge = await db.select().from(cityKnowledge);
      return searchInKnowledge(newKnowledge, queryEmbedding, limit);
    }

    return searchInKnowledge(allKnowledge, queryEmbedding, limit);
  } catch (error) {
    console.error('Vector search failed:', error);
    return [];
  }
}

function searchInKnowledge(
  knowledge: any[],
  queryEmbedding: number[],
  limit: number,
) {
  const results = knowledge
    .map((item: any) => ({
      content: item.content,
      metadata: item.metadata,
      similarity: cosineSimilarity(queryEmbedding, item.embedding as number[]),
    }))
    .filter((item: any) => item.similarity > 0.1) // Minimum similarity threshold
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

// Add content to knowledge base
export async function addToKnowledgeBase(
  content: string,
  metadata: Record<string, any>,
): Promise<void> {
  try {
    const embedding = generateSimpleEmbedding(content);

    await db.insert(cityKnowledge).values({
      content,
      metadata,
      embedding: embedding as any, // JSON storage
    });
  } catch (error) {
    console.error('Failed to add to knowledge base:', error);
  }
}

// Initialize with basic city data
export async function initializeKnowledgeBase(): Promise<void> {
  const basicCityData = [
    {
      content:
        'San Francisco has high cost of living, great tech jobs, mild climate year-round, excellent public transportation with MUNI and BART, vibrant startup culture, and diverse neighborhoods like Mission, SOMA, and Castro.',
      metadata: { city: 'San Francisco', category: 'overview', state: 'CA' },
    },
    {
      content:
        'Austin, Texas offers lower cost of living than coastal cities, growing tech scene with companies like Dell and IBM, hot summers, great music culture on 6th Street, food trucks, no state income tax, and Keep Austin Weird vibe.',
      metadata: { city: 'Austin', category: 'overview', state: 'TX' },
    },
    {
      content:
        'Seattle has moderate cost of living, major tech companies like Amazon and Microsoft, rainy climate with beautiful summers, strong coffee culture, Pike Place Market, and outdoor activities near mountains and water.',
      metadata: { city: 'Seattle', category: 'overview', state: 'WA' },
    },
    {
      content:
        'New York City offers unlimited career opportunities, expensive cost of living, excellent public transportation, diverse neighborhoods, world-class museums and restaurants, but small living spaces and fast-paced lifestyle.',
      metadata: { city: 'New York', category: 'overview', state: 'NY' },
    },
    {
      content:
        'Denver, Colorado has growing tech and startup scene, moderate cost of living, 300+ days of sunshine, excellent outdoor recreation with skiing and hiking, craft beer culture, and healthy lifestyle focus.',
      metadata: { city: 'Denver', category: 'overview', state: 'CO' },
    },
    {
      content:
        'Remote work opportunities are abundant in tech, marketing, writing, design, consulting, and customer service. Consider time zones, internet reliability, and home office setup when choosing location.',
      metadata: { category: 'remote-work', topic: 'opportunities' },
    },
    {
      content:
        'When evaluating cities for relocation, consider job market strength, cost of living ratios, climate preferences, commute options, school quality for families, healthcare access, and lifestyle factors like culture and recreation.',
      metadata: { category: 'relocation-tips', topic: 'evaluation' },
    },
    {
      content:
        'Housing costs typically include rent/mortgage, utilities, internet, parking, and maintenance. Budget 25-30% of income for housing in affordable areas, up to 50% in expensive cities like SF or NYC.',
      metadata: { category: 'housing', topic: 'costs' },
    },
  ];

  // Check if knowledge base is empty
  const existingCount = await db.select().from(cityKnowledge);

  if (existingCount.length === 0) {
    console.log('Initializing knowledge base with basic city data...');
    for (const data of basicCityData) {
      await addToKnowledgeBase(data.content, data.metadata);
    }
    console.log('Knowledge base initialized with local embeddings!');
  }
}
