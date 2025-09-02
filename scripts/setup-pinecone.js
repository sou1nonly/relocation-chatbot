// Setup script for Pinecone vector database
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

// Sample city relocation data
const cityData = [
  {
    id: 'austin-tech',
    content:
      'Austin, Texas is a major tech hub with companies like Dell, IBM, and many startups. Cost of living is moderate, great food scene, and no state income tax. Average rent for 1BR is $1,800.',
    metadata: {
      city: 'Austin',
      state: 'Texas',
      category: 'tech',
      cost_level: 'moderate',
    },
  },
  {
    id: 'denver-outdoors',
    content:
      'Denver, Colorado offers amazing outdoor recreation with easy access to skiing and hiking. Growing tech scene, legal cannabis, but higher altitude affects some people. Average rent for 1BR is $2,000.',
    metadata: {
      city: 'Denver',
      state: 'Colorado',
      category: 'outdoors',
      cost_level: 'high',
    },
  },
  {
    id: 'nashville-music',
    content:
      'Nashville, Tennessee is the music capital with vibrant nightlife and growing healthcare industry. No state income tax, affordable housing, but hot summers. Average rent for 1BR is $1,400.',
    metadata: {
      city: 'Nashville',
      state: 'Tennessee',
      category: 'culture',
      cost_level: 'moderate',
    },
  },
  {
    id: 'seattle-tech',
    content:
      'Seattle, Washington is home to Amazon, Microsoft, and many tech companies. High salaries but also high cost of living and frequent rain. Average rent for 1BR is $2,400.',
    metadata: {
      city: 'Seattle',
      state: 'Washington',
      category: 'tech',
      cost_level: 'very_high',
    },
  },
  {
    id: 'miami-lifestyle',
    content:
      'Miami, Florida offers beach lifestyle, international business connections, and no state income tax. Hot humid climate, hurricane risk, and expensive housing. Average rent for 1BR is $2,200.',
    metadata: {
      city: 'Miami',
      state: 'Florida',
      category: 'lifestyle',
      cost_level: 'high',
    },
  },
];

async function setupPinecone() {
  try {
    console.log('🔄 Setting up Pinecone index...');

    // Check if index exists
    const indexName = process.env.PINECONE_INDEX_NAME || 'relocation-adv';

    try {
      const indexStats = await pinecone.index(indexName).describeIndexStats();
      console.log('✅ Index already exists:', indexStats);
    } catch (error) {
      console.log('📝 Creating new index...');

      // Create index if it doesn't exist
      await pinecone.createIndex({
        name: indexName,
        dimension: 768, // Google embedding dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: process.env.PINECONE_ENV || 'us-east-1',
          },
        },
      });

      // Wait for index to be ready
      console.log('⏳ Waiting for index to be ready...');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    const index = pinecone.index(indexName);

    // Generate embeddings and upsert data
    console.log('🤖 Generating embeddings and uploading data...');

    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    const vectors = [];

    for (const item of cityData) {
      try {
        const result = await model.embedContent(item.content);
        const embedding = result.embedding.values;

        vectors.push({
          id: item.id,
          values: embedding,
          metadata: {
            content: item.content,
            ...item.metadata,
          },
        });

        console.log(`✅ Generated embedding for ${item.id}`);
      } catch (error) {
        console.error(`❌ Error generating embedding for ${item.id}:`, error);
      }
    }

    if (vectors.length > 0) {
      await index.upsert(vectors);
      console.log(
        `🎉 Successfully uploaded ${vectors.length} vectors to Pinecone!`,
      );

      // Verify the upload
      const stats = await index.describeIndexStats();
      console.log('📊 Index stats:', stats);
    }
  } catch (error) {
    console.error('❌ Error setting up Pinecone:', error);
  }
}

setupPinecone();
