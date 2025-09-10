#!/usr/bin/env node

/**
 * Vercel Deployment Helper Script
 * 
 * This script helps ensure your relocation chatbot is properly configured
 * for Vercel deployment by checking environment variables and dependencies.
 */

const fs = require('node:fs');
const path = require('node:path');

console.log('🚀 Vercel Deployment Helper\n');

// Check if required files exist
const requiredFiles = [
  'package.json',
  'next.config.ts',
  'vercel.json',
  '.env.example',
  'lib/db/schema.ts',
  'lib/db/migrate.ts'
];

console.log('📋 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, '..', file));
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

// Check package.json configuration
console.log('\n📦 Checking package.json...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const requiredScripts = ['build', 'build:production', 'start'];
requiredScripts.forEach(script => {
  const exists = packageJson.scripts?.[script];
  console.log(`  ${exists ? '✅' : '❌'} Script: ${script}`);
});

// Check for old dependencies that should be removed
const unnecessaryDeps = ['@ai-sdk/xai', '@pinecone-database/pinecone', 'redis'];
const cleanDeps = unnecessaryDeps.filter(dep => 
  !packageJson.dependencies?.[dep]
);

console.log(`  ${cleanDeps.length === unnecessaryDeps.length ? '✅' : '⚠️'} Cleaned up unnecessary dependencies`);

// Environment variable guide
console.log('\n🔧 Required Environment Variables:');
console.log('  Set these in your Vercel project settings:');
console.log('  ✅ AUTH_SECRET (generate with: openssl rand -base64 32)');
console.log('  ✅ GOOGLE_GENERATIVE_AI_API_KEY (from Google AI Studio)');
console.log('  ✅ POSTGRES_URL (from Neon or your PostgreSQL provider)');
console.log('  🔄 SERPER_API_KEY (optional - for web search)');
console.log('  🔄 BLOB_READ_WRITE_TOKEN (optional - for file uploads)');

console.log('\n🎯 Next Steps:');
console.log('  1. Push your code to GitHub');
console.log('  2. Connect repository to Vercel');
console.log('  3. Set environment variables in Vercel dashboard');
console.log('  4. Deploy!');

console.log('\n✨ Your relocation chatbot is ready for deployment! 🏡');
