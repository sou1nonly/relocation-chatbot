# 🚀 Vercel Deployment Guide

## Ready for Deployment! ✅

Your relocation chatbot is optimized and ready for Vercel deployment.

## 🔧 Environment Variables

Set these in your Vercel project settings under **Environment Variables**:

### ✅ Required Variables
```env
AUTH_SECRET=your-random-secret-key-here
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key
POSTGRES_URL=your-postgresql-connection-string
```

### 🔄 Optional Variables (for enhanced features)
```env
SERPER_API_KEY=your-serper-search-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

## 📋 Pre-Deployment Checklist

- [ ] **Database Ready**: PostgreSQL database created (recommend [Neon](https://neon.tech/))
- [ ] **Google AI Key**: Generated at [Google AI Studio](https://aistudio.google.com/app/apikey)
- [ ] **Auth Secret**: Generated with `openssl rand -base64 32`
- [ ] **Repository Connected**: GitHub repo linked to Vercel

## 🚀 Deploy Steps

### Option 1: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sou1nonly/relocation-chatbot&env=AUTH_SECRET,GOOGLE_GENERATIVE_AI_API_KEY,POSTGRES_URL&envDescription=Required%20environment%20variables%20for%20the%20relocation%20chatbot&envLink=https://github.com/sou1nonly/relocation-chatbot#configuration)

### Option 2: Manual Deploy
1. **Import Project** in Vercel dashboard
2. **Connect Repository** from GitHub
3. **Configure Environment Variables** (see above)
4. **Deploy** - Vercel will automatically build and deploy

## ⚙️ Build Configuration

The project is configured with:
- **Build Command**: `pnpm build:production`
- **Install Command**: `pnpm install`
- **Database Migrations**: Automatically run during build
- **API Timeout**: 30 seconds for AI responses

## 🎯 Post-Deployment

After successful deployment:
1. **Test Authentication**: Try signing up/in
2. **Test Chat**: Send a relocation question
3. **Check Memory**: Verify conversation memory works
4. **Monitor Logs**: Check Vercel function logs for any issues

## 🛠️ Troubleshooting

### Common Issues:
- **Build Fails**: Check environment variables are set correctly
- **Database Errors**: Verify `POSTGRES_URL` connection string
- **AI Errors**: Confirm `GOOGLE_GENERATIVE_AI_API_KEY` is valid
- **Auth Issues**: Regenerate `AUTH_SECRET` if needed
- ✅ Handles UserMemory table creation

## Build Status
✅ Local build successful (when POSTGRES_URL is set)
✅ All dependencies cleaned up
✅ No test references remaining
✅ Bundle size optimized
