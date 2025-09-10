import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import {
  saveUserMemory,
  getUserMemory,
  deleteUserMemory,
} from '@/lib/db/queries';

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
  budget?: string;
  discussedCities?: string[];
  transportationConcerns?: string[];
  workSetup?: string;
  costOfLivingPreferences?: string[];
  preferredNeighborhoods?: string[];
  timeframe?: string;
  mustHaveAmenities?: string[];
  dealBreakers?: string[];
}

export interface ContextualMemory {
  userProfile: UserPreferences;
  conversationSummary: ConversationSummary;
  recentSearches: string[];
  lastWebSearchTimestamp?: Date;
  adaptivePrompts: string[];
}

// Cache layer for performance (but data persists in DB)
const memoryCache = new Map<string, ContextualMemory>();

// ===== CORE MEMORY FUNCTIONS =====

export async function saveConversationSummary(
  userId: string,
  summary: ConversationSummary,
): Promise<void> {
  try {
    await saveUserMemory({
      userId,
      key: 'conversation_summary',
      value: summary,
    });

    // Clear cache so it gets reloaded
    memoryCache.delete(userId);
  } catch (error) {
    console.error('Failed to save conversation summary:', error);
  }
}

export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences,
): Promise<void> {
  try {
    await saveUserMemory({
      userId,
      key: 'user_preferences',
      value: preferences,
    });

    // Clear cache so it gets reloaded
    memoryCache.delete(userId);
  } catch (error) {
    console.error('Failed to save user preferences:', error);
  }
}

export async function getConversationSummary(
  userId: string,
): Promise<ConversationSummary | null> {
  try {
    const summaryData = await getUserMemory({
      userId,
      key: 'conversation_summary',
    });

    if (!summaryData) return null;

    return summaryData.value as ConversationSummary;
  } catch (error) {
    console.error('Failed to get conversation summary:', error);
    return null;
  }
}

export async function getUserPreferencesFromDb(
  userId: string,
): Promise<UserPreferences | null> {
  try {
    const preferenceData = await getUserMemory({
      userId,
      key: 'user_preferences',
    });

    if (!preferenceData) return null;

    return preferenceData.value as UserPreferences;
  } catch (error) {
    console.error('Failed to get user preferences:', error);
    return null;
  }
}

// Alias for backwards compatibility
export const getUserPreferences = getUserPreferencesFromDb;

export async function getContextualMemory(
  userId: string,
): Promise<ContextualMemory | null> {
  try {
    // Get cached version first for performance
    if (memoryCache.has(userId)) {
      const cached = memoryCache.get(userId);
      if (cached) return cached;
    }

    // Load from database
    const [summary, preferences] = await Promise.all([
      getConversationSummary(userId),
      getUserPreferencesFromDb(userId),
    ]);

    if (!summary && !preferences) return null;

    const contextualMemory: ContextualMemory = {
      userProfile: preferences || {},
      conversationSummary: summary || {
        summary: '',
        lastUpdated: new Date(),
        messageCount: 0,
        keyTopics: [],
        urgentQueries: [],
        locationContext: [],
      },
      recentSearches: [],
      adaptivePrompts: summary ? generateAdaptivePrompts(summary) : [],
    };

    // Cache for performance
    memoryCache.set(userId, contextualMemory);

    return contextualMemory;
  } catch (error) {
    console.error('Failed to get contextual memory:', error);
    return null;
  }
}

// ===== MEMORY UPDATE FUNCTIONS =====

export async function updateConversationSummary(
  userId: string,
  userInput: string,
  botResponse: string,
  previousMessages: Array<{ role: string; content: string }>,
): Promise<ConversationSummary> {
  const maxTokens = 600;

  try {
    // Get existing summary
    const existingSummary = await getConversationSummary(userId);

    // Prepare conversation history for summarization
    const recentHistory = previousMessages.slice(-10); // Last 10 messages
    const conversationText = recentHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Enhance summarization with contextual extraction
    const prompt = `Based on this conversation about city relocation, extract:
1. A concise summary of the discussion
2. Key topics discussed (comma-separated)
3. Any urgent/time-sensitive queries (comma-separated)
4. Cities/locations mentioned (comma-separated)

Conversation:
${conversationText}

User: ${userInput}
Assistant: ${botResponse}

${existingSummary?.summary ? `Previous summary: ${existingSummary.summary}` : ''}

Format:
SUMMARY: [comprehensive summary]
TOPICS: [topic1, topic2, topic3]
URGENT: [urgent1, urgent2]
LOCATIONS: [city1, city2, city3]`;

    const { text: result } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt,
    });

    // Parse the structured response
    const summaryMatch = result.match(/SUMMARY:\s*(.+?)(?=\n[A-Z]+:|$)/s);
    const topicsMatch = result.match(/TOPICS:\s*(.+?)(?=\n[A-Z]+:|$)/s);
    const urgentMatch = result.match(/URGENT:\s*(.+?)(?=\n[A-Z]+:|$)/s);
    const locationsMatch = result.match(/LOCATIONS:\s*(.+?)(?=\n[A-Z]+:|$)/s);

    const summary = summaryMatch?.[1]?.trim() || 'No summary available';
    const keyTopics =
      topicsMatch?.[1]
        ?.split(',')
        .map((t) => t.trim())
        .filter(Boolean) || [];
    const urgentQueries =
      urgentMatch?.[1]
        ?.split(',')
        .map((t) => t.trim())
        .filter(Boolean) || [];
    const locationContext =
      locationsMatch?.[1]
        ?.split(',')
        .map((t) => t.trim())
        .filter(Boolean) || [];

    const conversationSummary: ConversationSummary = {
      summary,
      lastUpdated: new Date(),
      messageCount: recentHistory.length,
      keyTopics,
      urgentQueries,
      locationContext,
    };

    // Save to database
    await saveConversationSummary(userId, conversationSummary);

    // Also extract user preferences
    await extractAndSaveUserPreferences(userId, summary);

    return conversationSummary;
  } catch (error) {
    console.error('Error updating conversation summary:', error);

    // Return existing summary or empty one
    const existing = await getConversationSummary(userId);
    return (
      existing || {
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

async function extractAndSaveUserPreferences(
  userId: string,
  summary: string,
): Promise<void> {
  try {
    // Extract preferences using AI
    const { text: result } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: `Extract user preferences from this conversation summary about city relocation:
      
"${summary}"

Extract key preferences in JSON format:
{
  "careerField": "field if mentioned",
  "budget": "budget if mentioned", 
  "lifestyleNeeds": ["need1", "need2"],
  "discussedCities": ["city1", "city2"],
  "workSetup": "remote/hybrid/office if mentioned"
}

Return only valid JSON, no additional text.`,
    });

    // Try to parse as JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const preferences = JSON.parse(jsonMatch[0]);

      // Get existing preferences and merge
      const existing = (await getUserPreferencesFromDb(userId)) || {};
      const merged = { ...existing, ...preferences };

      // Save updated preferences
      await saveUserPreferences(userId, merged);
    }
  } catch (error) {
    console.error('Error extracting user preferences:', error);
  }
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

// ===== ENHANCED CONTEXT FUNCTIONS =====

export async function getEnhancedContext(userId: string): Promise<{
  memory: ContextualMemory | null;
  shouldUseWebSearch: boolean;
  contextualPrompts: string[];
  recentTopics: string[];
}> {
  const memory = await getContextualMemory(userId);

  // Determine if web search should be prioritized
  const shouldUseWebSearch = Boolean(
    memory?.conversationSummary.urgentQueries.length ||
      (memory?.lastWebSearchTimestamp &&
        Date.now() - memory.lastWebSearchTimestamp.getTime() < 300000), // 5 minutes
  );

  const contextualPrompts = [
    ...(memory?.adaptivePrompts || []),
    ...(memory?.userProfile.discussedCities?.length
      ? [
          `Focus on ${memory.userProfile.discussedCities.slice(0, 3).join(', ')} based on previous discussion`,
        ]
      : []),
    ...(memory?.userProfile.careerField
      ? [`Consider ${memory.userProfile.careerField} career opportunities`]
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

export async function updateWebSearchTimestamp(userId: string): Promise<void> {
  try {
    await saveUserMemory({
      userId,
      key: 'web_search_timestamp',
      value: new Date().toISOString(),
    });

    // Clear cache
    memoryCache.delete(userId);
  } catch (error) {
    console.error('Failed to update web search timestamp:', error);
  }
}

// ===== MEMORY REPAIR FUNCTIONS =====

export function needsMemoryRepair(response: string): boolean {
  const forgetfulPhrases = [
    "I don't have information about your previous",
    "I don't recall",
    "I don't remember",
    "I wasn't aware of your",
    "You haven't mentioned",
    "I don't have context about",
  ];

  return forgetfulPhrases.some((phrase) =>
    response.toLowerCase().includes(phrase.toLowerCase()),
  );
}

export async function repairMemoryResponse(
  userId: string,
  userInput: string,
  originalResponse: string,
): Promise<string> {
  try {
    const memory = await getContextualMemory(userId);

    if (!memory?.conversationSummary.summary && !memory?.userProfile) {
      return originalResponse;
    }

    const contextPrompt = [
      memory?.conversationSummary.summary &&
        `Previous conversation context: ${memory.conversationSummary.summary}`,
      memory?.userProfile.careerField &&
        `User's career: ${memory.userProfile.careerField}`,
      memory?.userProfile.budget &&
        `User's budget: ${memory.userProfile.budget}`,
      memory?.userProfile.discussedCities?.length &&
        `Previously discussed cities: ${memory.userProfile.discussedCities.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const { text: repairedResponse } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      prompt: `The AI gave a response that ignored previous conversation context. Please provide a better response that acknowledges the user's history.

Previous context:
${contextPrompt}

User's current question: ${userInput}
AI's forgetful response: ${originalResponse}

Provide a contextually aware response that references relevant previous discussion:`,
    });

    return repairedResponse;
  } catch (error) {
    console.error('Error repairing memory response:', error);
    return originalResponse;
  }
}

// ===== CLEANUP FUNCTIONS =====

export async function clearUserMemory(userId: string): Promise<void> {
  try {
    await deleteUserMemory({ userId });
    memoryCache.delete(userId);
  } catch (error) {
    console.error('Failed to clear user memory:', error);
  }
}
