import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export interface ConversationSummary {
  summary: string;
  lastUpdated: Date;
  messageCount: number;
  keyTopics: string[];
  urgentQueries: string[];
  locationContext: string[];
}

export interface UserPreferences {
  careerField?: string;
  jobPreferences?: string[];
  lifestyleNeeds?: string[];
  familyRequirements?: string[];
  housingConstraints?: string;
  budget?: string; // Budget in INR (lakhs/thousands)
  discussedCities?: string[]; // Indian cities
  transportationConcerns?: string[];
  workSetup?: string;
  costOfLivingPreferences?: string[];
  preferredNeighborhoods?: string[]; // Indian localities/areas
  timeframe?: string;
  mustHaveAmenities?: string[];
  dealBreakers?: string[];
  // Indian-specific preferences
  languagePreferences?: string[]; // Hindi, English, regional languages
  regionalPreferences?: string[]; // North India, South India, West India, East India  
  climatePreferences?: string[]; // Monsoon tolerance, temperature preferences
  culturalFit?: string[]; // Traditional, cosmopolitan, local culture importance
  itHubPreferences?: string[]; // Electronic City, Gurgaon, HITEC City, etc.
}

export interface ContextualMemory {
  userProfile: UserPreferences;
  conversationSummary: ConversationSummary;
  recentSearches: string[];
  lastWebSearchTimestamp?: Date;
  adaptivePrompts: string[];
}

// Enhanced in-memory storage with context tracking
const contextualMemories = new Map<string, ContextualMemory>();
const summaries = new Map<string, ConversationSummary>();
const userPreferences = new Map<string, UserPreferences>();

export async function updateConversationSummary(
  userId: string,
  userInput: string,
  botResponse: string,
  previousMessages: Array<{ role: string; content: string }>,
): Promise<ConversationSummary> {
  const maxTokens = 600;

  // Create conversation history with better context window
  const history = [
    ...previousMessages.slice(-15), // Increased context window
    { role: 'user', content: userInput },
    { role: 'assistant', content: botResponse },
  ];

  const conversationText = history
    .map(
      (msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`,
    )
    .join('\n\n');

  const enhancedSummarizationPrompt = `
You are an AI assistant specializing in city relocation analysis. Extract actionable insights and context from this conversation.

Extract and structure:
1. CORE USER PROFILE:
   - Career field, job level, industry
   - Family situation (single, married, kids, dependents)
   - Age range and lifestyle preferences
   - Remote/hybrid/in-office work setup in Indian context

2. INDIAN RELOCATION CRITERIA:
   - Budget constraints (housing in INR, overall cost of living)
   - Preferred city size (metro/tier-1/tier-2) and characteristics
   - Language preferences and regional cultural fit
   - Must-have amenities (metro connectivity, IT parks proximity, schools)
   - Climate preferences (monsoon tolerance, temperature preferences)
   - Timeline for moving (avoiding monsoon season if needed)

3. DISCUSSED INDIAN LOCATIONS:
   - Indian cities mentioned positively (Bangalore, Mumbai, Delhi, Pune, etc.)
   - Cities mentioned negatively with reasons
   - Specific areas or IT hubs (Electronic City, Gurgaon, etc.)
   - Comparison criteria used (cost, climate, job market, culture)

4. URGENT/RECENT QUERIES:
   - Time-sensitive questions asked
   - Real-time information needs about Indian cities
   - Immediate concerns or priorities for Indian relocation

5. INDIAN CONTEXT ADAPTIVE:
   - Regional preferences (North vs South India)
   - Language comfort levels
   - Monsoon and festival timing considerations
   - IT job market and startup ecosystem preferences

Conversation:
${conversationText}

Provide a structured summary focusing on actionable relocation insights:`;

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'), // Using Gemini for memory processing
      prompt: enhancedSummarizationPrompt,
      temperature: 0.1,
    });

    const summary = text.trim();

    // Extract key topics and urgent queries from the summary
    const keyTopics = extractKeyTopics(summary);
    const urgentQueries = extractUrgentQueries(userInput, botResponse);
    const locationContext = extractLocationContext(summary);

    const conversationSummary: ConversationSummary = {
      summary,
      lastUpdated: new Date(),
      messageCount: history.length,
      keyTopics,
      urgentQueries,
      locationContext,
    };

    summaries.set(userId, conversationSummary);

    // Update contextual memory
    await updateContextualMemory(userId, conversationSummary, userInput);

    // Also extract structured preferences with enhanced logic
    await extractUserPreferences(userId, summary);

    return conversationSummary;
  } catch (error) {
    console.error('Error updating conversation summary:', error);

    // Return existing summary or enhanced empty one
    return (
      summaries.get(userId) || {
        summary: '',
        lastUpdated: new Date(),
        messageCount: 0,
        keyTopics: [],
        urgentQueries: [],
        locationContext: [],
      }
    );
  }
}

async function updateContextualMemory(
  userId: string,
  summary: ConversationSummary,
  userInput: string,
): Promise<void> {
  const existingMemory = contextualMemories.get(userId) || {
    userProfile: {},
    conversationSummary: summary,
    recentSearches: [],
    adaptivePrompts: [],
  };

  // Track recent searches and queries
  if (userInput.length > 10) {
    existingMemory.recentSearches.unshift(userInput);
    existingMemory.recentSearches = existingMemory.recentSearches.slice(0, 10);
  }

  // Generate adaptive prompts based on conversation patterns
  existingMemory.adaptivePrompts = generateAdaptivePrompts(summary);

  existingMemory.conversationSummary = summary;
  contextualMemories.set(userId, existingMemory);
}

function extractKeyTopics(summary: string): string[] {
  const topicKeywords = [
    'career',
    'job',
    'work',
    'remote',
    'office',
    'housing',
    'rent',
    'buy',
    'budget',
    'cost',
    'family',
    'schools',
    'safety',
    'kids',
    'climate',
    'weather',
    'transportation',
    'commute',
    'nightlife',
    'culture',
    'food',
    'entertainment',
    'healthcare',
    'hospitals',
    'fitness',
    'outdoors',
  ];

  return topicKeywords
    .filter((keyword) => summary.toLowerCase().includes(keyword))
    .slice(0, 8);
}

function extractUrgentQueries(
  userInput: string,
  botResponse: string,
): string[] {
  const urgentIndicators = [
    'today',
    'now',
    'current',
    'latest',
    'immediate',
    'urgent',
    'asap',
    'quickly',
    'recent',
    'this week',
  ];

  const isUrgent = urgentIndicators.some((indicator) =>
    userInput.toLowerCase().includes(indicator),
  );

  return isUrgent ? [userInput] : [];
}

function extractLocationContext(summary: string): string[] {
  // Extract mentioned cities and locations
  const locationPattern =
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|CA|NY|TX|FL|WA|OR|CO|NC|GA|IL|MA|PA|VA|MD|DC))\b/g;
  const matches = summary.match(locationPattern) || [];
  return [...new Set(matches)].slice(0, 10);
}

function generateAdaptivePrompts(summary: ConversationSummary): string[] {
  const prompts: string[] = [];

  if (summary.keyTopics.includes('career')) {
    prompts.push('Consider career growth opportunities and industry presence');
  }

  if (summary.keyTopics.includes('family')) {
    prompts.push('Prioritize family-friendly amenities and school districts');
  }

  if (summary.urgentQueries.length > 0) {
    prompts.push('Focus on time-sensitive and current information');
  }

  if (summary.locationContext.length > 2) {
    prompts.push('Provide comparative analysis between discussed cities');
  }

  return prompts;
}

export function getConversationSummary(
  userId: string,
): ConversationSummary | null {
  return summaries.get(userId) || null;
}

export function getUserPreferences(userId: string): UserPreferences | null {
  return userPreferences.get(userId) || null;
}

export function getContextualMemory(userId: string): ContextualMemory | null {
  return contextualMemories.get(userId) || null;
}

export function getEnhancedContext(userId: string): {
  memory: ContextualMemory | null;
  shouldUseWebSearch: boolean;
  contextualPrompts: string[];
  recentTopics: string[];
} {
  const memory = getContextualMemory(userId);
  const preferences = getUserPreferences(userId);

  // Determine if web search should be prioritized based on context
  const shouldUseWebSearch = Boolean(
    memory?.conversationSummary.urgentQueries.length ||
      (memory?.lastWebSearchTimestamp &&
        Date.now() - memory.lastWebSearchTimestamp.getTime() < 300000), // 5 minutes
  );

  // Generate contextual prompts based on user history
  const contextualPrompts = [
    ...(memory?.adaptivePrompts || []),
    ...(preferences?.discussedCities?.length
      ? [
          `Focus on ${preferences.discussedCities.slice(0, 3).join(', ')} based on previous discussion`,
        ]
      : []),
    ...(preferences?.careerField
      ? [`Consider ${preferences.careerField} career opportunities`]
      : []),
  ];

  const recentTopics = memory?.conversationSummary.keyTopics || [];

  return {
    memory,
    shouldUseWebSearch,
    contextualPrompts,
    recentTopics,
  };
}

export function updateWebSearchTimestamp(userId: string): void {
  const memory = contextualMemories.get(userId);
  if (memory) {
    memory.lastWebSearchTimestamp = new Date();
    contextualMemories.set(userId, memory);
  }
}

async function extractUserPreferences(
  userId: string,
  summary: string,
): Promise<void> {
  const extractionPrompt = `
Extract structured information from this conversation summary about a user's city relocation preferences.

Summary: ${summary}

Extract and format as JSON with these fields (use null for unknown/not mentioned):
{
  "careerField": "string or null",
  "jobPreferences": ["array of strings or empty"],
  "lifestyleNeeds": ["climate preferences, walkability, etc."],
  "familyRequirements": ["schools, safety, etc."],
  "housingConstraints": "string or null",
  "budget": "string or null",
  "discussedCities": ["array of cities mentioned"],
  "transportationConcerns": ["public transit, car dependency, etc."],
  "workSetup": "remote/hybrid/office or null",
  "costOfLivingPreferences": ["array of preferences"]
}

Return only valid JSON:`;

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'), // Using Gemini for memory processing
      prompt: extractionPrompt,
      temperature: 0.1,
    });

    const preferences = JSON.parse(text.trim()) as UserPreferences;
    userPreferences.set(userId, preferences);
  } catch (error) {
    console.error('Error extracting user preferences:', error);
  }
}

export function needsMemoryRepair(response: string): boolean {
  const memoryDenialPhrases = [
    "i don't have memory",
    'i have no memory',
    'each interaction starts fresh',
    "i don't retain information",
    "i don't remember",
    "i don't have personal experiences",
    "i don't know about your previous",
    'i need more context',
    'i need more information about your preferences',
  ];

  return memoryDenialPhrases.some((phrase) =>
    response.toLowerCase().includes(phrase),
  );
}

export async function repairMemoryResponse(
  userId: string,
  userInput: string,
  originalResponse: string,
): Promise<string> {
  const summary = getConversationSummary(userId);
  const preferences = getUserPreferences(userId);

  if (!summary?.summary && !preferences) {
    return originalResponse;
  }

  const contextInfo = [
    summary?.summary && `Previous conversation context: ${summary.summary}`,
    preferences && `User preferences: ${JSON.stringify(preferences, null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const repairPrompt = `
The user thinks you forgot their earlier context, but you have this information about them:

${contextInfo}

Original user question: ${userInput}

Your previous response seemed to ignore this context: ${originalResponse}

Now provide a better response that acknowledges their previous context and preferences. Be natural and conversational, don't just list what you know about them.`;

  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash'), // Using Gemini for memory processing
      prompt: repairPrompt,
      temperature: 0.3,
    });

    return text.trim();
  } catch (error) {
    console.error('Error repairing memory response:', error);
    return originalResponse;
  }
}

/**
 * Update memory data manually from the UI
 */
export async function updateMemoryData(userId: string, memoryData: any) {
  try {
    // Update conversation summary
    if (memoryData.summary) {
      const updatedSummary: ConversationSummary = {
        summary: memoryData.summary,
        lastUpdated: new Date(),
        messageCount: memoryData.messageCount || 0,
        keyTopics: memoryData.keyTopics || [],
        urgentQueries: memoryData.urgentQueries || [],
        locationContext: memoryData.locationContext || [],
      };
      summaries.set(userId, updatedSummary);
    }

    // Update user preferences
    if (memoryData.userPreferences) {
      const updatedPreferences: UserPreferences = {
        careerField: memoryData.userPreferences.careerField,
        workSetup: memoryData.userPreferences.workSetup,
        budget: memoryData.userPreferences.budget,
        discussedCities: memoryData.userPreferences.discussedCities,
        // Keep other existing preferences that aren't editable in UI
        ...userPreferences.get(userId),
        // Override with new values
        ...memoryData.userPreferences,
      };
      userPreferences.set(userId, updatedPreferences);
    }

    // Update contextual memory
    const existingContextual = contextualMemories.get(userId);
    if (existingContextual) {
      existingContextual.conversationSummary =
        summaries.get(userId) || existingContextual.conversationSummary;
      existingContextual.userProfile =
        userPreferences.get(userId) || existingContextual.userProfile;
      contextualMemories.set(userId, existingContextual);
    }

    return true;
  } catch (error) {
    console.error('Error updating memory data:', error);
    throw new Error('Failed to update memory data');
  }
}
