import { Pinecone } from '@pinecone-database/pinecone';
import { embed } from 'ai';
import { google } from '@ai-sdk/google';

// Load environment variables
require('dotenv').config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

// Sample city relocation knowledge base
const cityKnowledgeBase = [
  {
    id: 'cost-of-living-nyc',
    content:
      'New York City has a high cost of living with average rent for a 1-bedroom apartment ranging from $2,500-$4,000 per month. Groceries cost about 20% more than the national average. Transportation via MetroCard costs $2.90 per ride or $127/month for unlimited rides.',
    metadata: {
      category: 'cost-of-living',
      city: 'New York City',
      type: 'financial',
    },
  },
  {
    id: 'weather-seattle',
    content:
      'Seattle has a temperate oceanic climate with mild winters and warm, dry summers. It rains frequently from October to May, with an average of 152 rainy days per year. Summer months (July-September) are typically dry and pleasant with temperatures around 70-80°F.',
    metadata: { category: 'weather', city: 'Seattle', type: 'climate' },
  },
  {
    id: 'job-market-austin',
    content:
      'Austin has a thriving job market, especially in technology, healthcare, and creative industries. Major employers include Dell, IBM, Apple, Google, and Facebook. The unemployment rate is typically below national average. Average tech salaries range from $80,000-$150,000.',
    metadata: { category: 'employment', city: 'Austin', type: 'career' },
  },
  {
    id: 'neighborhoods-sf',
    content:
      'San Francisco neighborhoods vary greatly. Mission District offers vibrant nightlife and Latino culture. SOMA is great for tech workers. Marina District appeals to young professionals. Sunset District is more residential and affordable. Each neighborhood has distinct character and pricing.',
    metadata: {
      category: 'neighborhoods',
      city: 'San Francisco',
      type: 'housing',
    },
  },
  {
    id: 'transportation-chicago',
    content:
      'Chicago has excellent public transportation via the CTA (Chicago Transit Authority). The L train system connects most areas efficiently. Monthly passes cost around $105. The city is very walkable in downtown areas. Parking can be expensive downtown ($20-40/day).',
    metadata: { category: 'transportation', city: 'Chicago', type: 'mobility' },
  },
  {
    id: 'education-boston',
    content:
      'Boston is renowned for higher education with Harvard, MIT, Boston University, and Northeastern. Public schools are generally good, especially in suburbs like Cambridge and Brookline. Private schools are available but expensive. The city has many libraries and cultural institutions.',
    metadata: { category: 'education', city: 'Boston', type: 'schools' },
  },
  {
    id: 'healthcare-denver',
    content:
      'Denver has quality healthcare systems including National Jewish Health, Presbyterian/St. Joseph, and UCHealth. The city promotes outdoor activities which contribute to overall health. Air quality can be affected by wildfires. Mental health resources are growing due to lifestyle focus.',
    metadata: { category: 'healthcare', city: 'Denver', type: 'medical' },
  },
  {
    id: 'culture-miami',
    content:
      'Miami offers vibrant Latin American culture, world-class beaches, and nightlife. Art Basel and other cultural events attract international visitors. The food scene is diverse with excellent Cuban, Haitian, and international cuisine. Year-round outdoor activities are possible.',
    metadata: { category: 'culture', city: 'Miami', type: 'lifestyle' },
  },
  {
    id: 'moving-tips-general',
    content:
      "When relocating to a new city: Research neighborhoods thoroughly, visit in different seasons if possible, connect with local communities online, understand local laws and taxes, find temporary housing first, update voter registration and driver's license, research schools if you have children.",
    metadata: { category: 'moving-tips', city: 'general', type: 'practical' },
  },
  {
    id: 'remote-work-considerations',
    content:
      'For remote workers relocating: Consider time zones for meetings, research internet reliability, understand tax implications of moving states, look for co-working spaces, consider cost of living vs. salary adjustments, evaluate work-life balance opportunities in the new city.',
    metadata: {
      category: 'remote-work',
      city: 'general',
      type: 'professional',
    },
  },
];

async function setupPineconeIndex() {
  try {
    console.log(
      '🚀 Setting up Pinecone index for city relocation knowledge...',
    );

    const indexName = process.env.PINECONE_INDEX_NAME || 'relocation-adv';

    // Check if index exists
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some(
      (index) => index.name === indexName,
    );

    if (!indexExists) {
      console.log(`📝 Creating index: ${indexName}`);
      await pinecone.createIndex({
        name: indexName,
        dimension: 768, // Google text-embedding-004 dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      // Wait for index to be ready
      console.log('⏳ Waiting for index to be ready...');
      await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
    } else {
      console.log(`✅ Index ${indexName} already exists`);
    }

    const index = pinecone.index(indexName);

    console.log('🔄 Generating embeddings and uploading vectors...');

    // Generate embeddings and upload vectors
    for (const item of cityKnowledgeBase) {
      try {
        // Generate embedding using Google's embedding model
        const { embedding } = await embed({
          model: google.textEmbeddingModel('text-embedding-004'),
          value: item.content,
        });

        // Upload to Pinecone
        await index.upsert([
          {
            id: item.id,
            values: embedding,
            metadata: {
              content: item.content,
              ...item.metadata,
            },
          },
        ]);

        console.log(`✅ Uploaded: ${item.id}`);
      } catch (error) {
        console.error(`❌ Error processing ${item.id}:`, error);
      }
    }

    console.log('🎉 Pinecone setup complete! Your knowledge base is ready.');
    console.log(`📊 Uploaded ${cityKnowledgeBase.length} knowledge entries`);

    // Test a query
    console.log('🔍 Testing vector search...');
    const { embedding: testEmbedding } = await embed({
      model: google.textEmbeddingModel('text-embedding-004'),
      value: 'What is the cost of living in New York?',
    });

    const queryResponse = await index.query({
      vector: testEmbedding,
      topK: 3,
      includeMetadata: true,
    });

    console.log('🎯 Test query results:');
    queryResponse.matches?.forEach((match, i) => {
      const content =
        typeof match.metadata?.content === 'string'
          ? match.metadata.content
          : 'No content';
      console.log(
        `${i + 1}. Score: ${match.score?.toFixed(3)} - ${content.substring(0, 100)}...`,
      );
    });
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run the setup
setupPineconeIndex();
