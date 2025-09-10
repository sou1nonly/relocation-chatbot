import type { Geo } from '@vercel/functions';

export const regularPrompt = `You are an expert city relocation assistant specializing in helping people find the perfect place to live. You provide personalized, context-aware recommendations based on user preferences, needs, and circumstances.

Core capabilities:
- Analyze cities based on cost of living, job markets, lifestyle, climate, and amenities
- Compare neighborhoods within cities for specific needs
- Provide real-time information about housing markets, weather, and local news using web search
- Maintain conversation memory and adapt responses based on user history
- Help with practical relocation planning (schools, transportation, etc.)

Intelligence features:
- Remember and reference previous conversations and user preferences
- Adapt recommendations based on evolving user needs
- Prioritize real-time data when users ask current/urgent questions
- Provide contextual follow-ups based on conversation patterns
- Recognize when users need immediate vs. research-based information

Guidelines:
- Always be conversational, helpful, and contextually aware
- Reference previous discussions naturally when relevant
- Use web search for current/time-sensitive information (weather, news, market trends)
- Adjust communication style based on user's expertise level and decision-making patterns
- Provide actionable advice with specific next steps when appropriate

Keep responses concise but comprehensive, and always leverage your memory of user preferences to provide increasingly personalized recommendations.`;

export interface RequestHints {
  latitude: Geo['latitude'];
  longitude: Geo['longitude'];
  city: Geo['city'];
  country: Geo['country'];
  userPreferences?: any;
  conversationSummary?: string;
  contextualPrompts?: string[];
  recentTopics?: string[];
  shouldPrioritizeWebSearch?: boolean;
  adaptiveContext?: string[];
}

export const getRequestPromptFromHints = (requestHints: RequestHints) => {
  let prompt = `About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}`;

  if (requestHints.conversationSummary) {
    prompt += `\n\nUser's conversation context and preferences:
${requestHints.conversationSummary}`;
  }

  if (requestHints.userPreferences) {
    prompt += `\n\nUser's structured preferences:
${JSON.stringify(requestHints.userPreferences, null, 2)}`;
  }

  if (requestHints.recentTopics && requestHints.recentTopics.length > 0) {
    prompt += `\n\nRecent conversation topics: ${requestHints.recentTopics.join(', ')}`;
  }

  if (
    requestHints.contextualPrompts &&
    requestHints.contextualPrompts.length > 0
  ) {
    prompt += `\n\nContextual guidance for this conversation:
${requestHints.contextualPrompts.map((p) => `- ${p}`).join('\n')}`;
  }

  if (requestHints.shouldPrioritizeWebSearch) {
    prompt += `\n\nIMPORTANT: User's query likely needs current/real-time information. Prioritize web search for up-to-date data.`;
  }

  if (requestHints.adaptiveContext && requestHints.adaptiveContext.length > 0) {
    prompt += `\n\nAdaptive context based on conversation patterns:
${requestHints.adaptiveContext.map((c) => `- ${c}`).join('\n')}`;
  }

  return prompt;
};

export const systemPrompt = ({
  selectedChatModel,
  requestHints,
}: {
  selectedChatModel: string;
  requestHints: RequestHints;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  return `${regularPrompt}\n\n${requestPrompt}`;
};
