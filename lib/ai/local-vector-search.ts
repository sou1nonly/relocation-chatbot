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
        "Bangalore (Bengaluru) is India's Silicon Valley with major tech companies like Infosys, Wipro, and TCS. Pleasant climate year-round, great pubs and restaurants, traffic congestion issues, average rent for 2BHK is ₹25,000-40,000. IT hubs: Electronic City, Whitefield, Koramangala.",
      metadata: {
        city: 'Bangalore',
        category: 'overview',
        state: 'Karnataka',
        country: 'India',
      },
    },
    {
      content:
        "Mumbai is India's financial capital with major banks, Bollywood, and corporate headquarters. Very expensive housing with 1BHK costing ₹30,000-60,000, excellent local trains, fast-paced lifestyle, monsoon rains, and diverse opportunities across industries.",
      metadata: {
        city: 'Mumbai',
        category: 'overview',
        state: 'Maharashtra',
        country: 'India',
      },
    },
    {
      content:
        'Delhi NCR (including Gurgaon and Noida) offers government jobs, corporates, startups, extreme weather (hot summers, cold winters), pollution concerns, good metro connectivity, 2BHK rent ₹20,000-35,000, rich history and culture.',
      metadata: {
        city: 'Delhi',
        category: 'overview',
        state: 'Delhi',
        country: 'India',
      },
    },
    {
      content:
        'Pune has a growing IT sector, pleasant weather, lower cost of living than Mumbai/Bangalore, good educational institutions, 2BHK rent ₹18,000-30,000, IT hubs in Hinjewadi and Magarpatta, and proximity to hill stations.',
      metadata: {
        city: 'Pune',
        category: 'overview',
        state: 'Maharashtra',
        country: 'India',
      },
    },
    {
      content:
        'Hyderabad (Cyberabad) has booming IT industry with Microsoft, Google offices, moderate cost of living, biryani culture, HITEC City tech hub, 2BHK rent ₹15,000-25,000, good infrastructure development, and Telangana government support for IT.',
      metadata: {
        city: 'Hyderabad',
        category: 'overview',
        state: 'Telangana',
        country: 'India',
      },
    },
    {
      content:
        'Chennai has strong automotive and IT industries, hot and humid climate, Tamil culture, Marina Beach, 2BHK rent ₹15,000-28,000, IT corridor in OMR (Old Mahabalipuram Road), and good south Indian food scene.',
      metadata: {
        city: 'Chennai',
        category: 'overview',
        state: 'Tamil Nadu',
        country: 'India',
      },
    },
    {
      content:
        'Remote work is growing in India with opportunities in tech, marketing, content writing, design, and consulting. Consider internet reliability (fiber broadband), power backup, and home office space. Tier-2 cities offer lower costs for remote workers.',
      metadata: {
        category: 'remote-work',
        topic: 'opportunities',
        country: 'India',
      },
    },
    {
      content:
        'When relocating within India, consider job market, cost of living, language barriers, climate (monsoon patterns), commute options, school quality for children, healthcare facilities, and cultural fit. Research local festivals and food preferences.',
      metadata: {
        category: 'relocation-tips',
        topic: 'evaluation',
        country: 'India',
      },
    },
    {
      content:
        'Housing costs in India include rent, security deposit (6-11 months), utilities, internet, parking, and maintenance. Budget 20-30% of income for rent in tier-2 cities, up to 40-50% in expensive cities like Mumbai and Bangalore.',
      metadata: { category: 'housing', topic: 'costs', country: 'India' },
    },
    {
      content:
        'Indian IT hubs: Bangalore (Electronic City, Whitefield), Hyderabad (HITEC City, Gachibowli), Pune (Hinjewadi, Magarpatta), Chennai (OMR, Sholinganallur), Delhi NCR (Gurgaon Cyber City, Noida), Mumbai (BKC, Powai). Each offers different lifestyle and cost benefits.',
      metadata: { category: 'tech-hubs', topic: 'locations', country: 'India' },
    },
    {
      content:
        'Monsoon season (June-September) affects relocation planning in India. Mumbai gets heavy rains, Bangalore has moderate rainfall, Delhi has brief monsoon. Plan moves during October-March for better weather and easier house hunting.',
      metadata: { category: 'weather', topic: 'monsoon', country: 'India' },
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
