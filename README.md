<div align="center">
  <h1>🏙️ AI Relocation Assistant</h1>
  <p>An intelligent chatbot that helps people find the perfect place to live</p>
</div>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#configuration"><strong>Configuration</strong></a> ·
  <a href="#deployment"><strong>Deployment</strong></a>
</p>

<br/>

## 🎯 About

This AI-powered relocation assistant helps users make informed decisions about where to live by providing:

- **Personalized city recommendations** based on individual preferences
- **Real-time information** about housing markets, weather, and local news
- **Intelligent memory system** that learns and remembers user preferences
- **Cost-effective local vector search** for city knowledge without expensive external services
- **Context-aware conversations** that improve over time

<br/>

## ✨ Features

### 🧠 Intelligent Conversation
- **Google Gemini 1.5 Flash** integration for natural, context-aware responses
- **Memory system** that remembers user preferences across sessions
- **Conversation summaries** for long-term context retention
- **Adaptive responses** based on user interaction patterns

### 🔍 Smart Knowledge System
- **Local vector search** - Cost-effective alternative to expensive services like Pinecone
- **City knowledge database** with embedding-based similarity search
- **Real-time web search** for current housing markets and city information
- **Weather integration** for location-specific climate data

### 🎯 Relocation-Focused Tools
- **Personalized city recommendations** based on career, lifestyle, and budget
- **Neighborhood comparisons** with detailed analysis
- **Cost of living calculations** and budget planning
- **Real-time housing market data** via web search
- **Climate and weather information** for decision-making

### 🔧 Technical Excellence
- **Next.js 15** with App Router and Turbopack for optimal performance
- **PostgreSQL** with Neon for reliable data persistence
- **Auth.js** for secure user authentication
- **shadcn/ui** with Tailwind CSS for modern, responsive design
- **TypeScript** for type-safe development

## 🛠️ Tech Stack

### AI & Machine Learning
- **[Google Gemini 1.5 Flash](https://ai.google.dev/)** - Primary language model for conversations
- **Local Vector Search** - Hash-based embeddings for cost-effective similarity search
- **Memory System** - Intelligent conversation context and user preference tracking

### Backend & Database
- **[Next.js 15](https://nextjs.org)** - React framework with App Router and Server Components
- **[PostgreSQL](https://www.postgresql.org/)** via [Neon](https://neon.tech/) - Serverless database for data persistence
- **[Drizzle ORM](https://orm.drizzle.team/)** - Type-safe database operations
- **[Auth.js](https://authjs.dev)** - Authentication and session management

### External APIs
- **[Serper API](https://serper.dev/)** - Real-time web search for current information
- **[Open-Meteo API](https://open-meteo.com/)** - Weather data for location analysis

### Frontend & UI
- **[React 18](https://react.dev/)** with Server Components
- **[Tailwind CSS](https://tailwindcss.com)** - Utility-first styling
- **[shadcn/ui](https://ui.shadcn.com)** - Beautiful, accessible components
- **[Radix UI](https://radix-ui.com)** - Headless component primitives

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and **pnpm** (recommended)
- **PostgreSQL database** (we recommend [Neon](https://neon.tech/) for serverless)
- **Google AI API key** for Gemini 1.5 Flash
- **Serper API key** for web search (optional but recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd relocation-chatbot
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your `.env` file** (see [Configuration](#configuration) section)

5. **Run database migrations**
   ```bash
   pnpm drizzle-kit generate
   pnpm drizzle-kit push
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

The application will be available at `http://localhost:3000`.

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

### Required Variables

```env
# Authentication Secret (generate with: openssl rand -base64 32)
AUTH_SECRET=your_random_secret_here

# Google AI API Key for Gemini models
# Get yours at: https://aistudio.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key

# PostgreSQL Database URL
# Use Neon (https://neon.tech/) for serverless PostgreSQL
POSTGRES_URL=postgresql://user:password@host:port/database
```

### Optional Variables

```env
# Web Search API Key (recommended for real-time information)
# Get yours at: https://serper.dev/ (2,500 free searches/month)
SERPER_API_KEY=your_serper_key

# File Storage (if you plan to add file upload features)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### API Key Setup Guide

1. **Google AI API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new project or select existing
   - Generate an API key
   - Enable the Generative AI API

2. **Serper API Key** (Optional):
   - Sign up at [Serper.dev](https://serper.dev/)
   - Get your free API key (2,500 searches/month)

3. **Database Setup**:
   - Create a free database at [Neon](https://neon.tech/)
   - Copy the connection string to `POSTGRES_URL`

## 🚀 Deployment

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sou1nonly/relocation-chatbot&env=AUTH_SECRET,GOOGLE_GENERATIVE_AI_API_KEY,POSTGRES_URL&envDescription=Required%20environment%20variables%20for%20the%20relocation%20chatbot)

### Manual Deployment

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** - Vercel will automatically build and deploy

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Deploy to Other Platforms

This is a standard Next.js application and can be deployed to:
- **Railway**
- **Render** 
- **AWS**
- **Google Cloud**
- Any platform supporting Node.js applications

## 🔧 Development

### Running Tests
```bash
pnpm test
```

### Database Operations
```bash
# Generate migrations
pnpm db:generate

# Push changes to database
pnpm db:push

# Open Drizzle Studio
pnpm db:studio
```

### Code Quality
```bash
# Lint and format
pnpm lint:fix
pnpm format
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues:
1. Check the [Issues](https://github.com/sou1nonly/relocation-chatbot/issues) page
2. Create a new issue with detailed information
3. Include error messages and system information

---

<div align="center">
  <strong>Built with ❤️ for helping people find their perfect home</strong>
</div>
