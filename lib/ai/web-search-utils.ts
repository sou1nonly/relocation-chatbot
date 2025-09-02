/**
 * Intelligent web search decision system using AI-powered analysis
 * Determines if a user query requires real-time web search based on intent and context
 */
export function needsWebSearch(
  prompt: string,
  contextualHints?: {
    recentTopics?: string[];
    urgentQueries?: string[];
    lastWebSearch?: Date;
    userPreferences?: any;
    conversationContext?: string[];
  },
): boolean {
  // Quick analysis of query characteristics
  const queryAnalysis = analyzeQueryIntent(prompt);

  // Smart decision based on multiple factors
  return makeIntelligentDecision(queryAnalysis, contextualHints);
}

/**
 * Analyzes the intent and characteristics of a user query
 */
function analyzeQueryIntent(prompt: string) {
  const lowercasePrompt = prompt.toLowerCase().trim();

  return {
    // Temporal indicators - suggests need for current information
    temporal: {
      isTimeSpecific:
        /\b(today|now|current|latest|recent|this (week|month|year)|2024|2025)\b/.test(
          lowercasePrompt,
        ),
      isEventBased: /\b(happening|going on|scheduled|upcoming|events)\b/.test(
        lowercasePrompt,
      ),
      isStatusQuery: /\b(is|are|status|available|open|closed)\b/.test(
        lowercasePrompt,
      ),
      urgencyLevel: getUrgencyLevel(lowercasePrompt),
    },

    // Location context - local/specific information needs
    location: {
      hasLocation: /\b(in|at|near|around|close to|within)\s+[A-Za-z]+/.test(
        prompt,
      ),
      isLocalQuery: /\b(local|nearby|here|around here)\b/.test(lowercasePrompt),
      specificPlace: extractLocationMentions(prompt),
    },

    // Information type - what kind of data is being requested
    informationType: {
      isFactual: /\b(what is|define|explain|how does|why)\b/.test(
        lowercasePrompt,
      ),
      isComparative:
        /\b(vs|versus|compare|better|best|worst|difference)\b/.test(
          lowercasePrompt,
        ),
      isRecommendation:
        /\b(recommend|suggest|best|top|good|should I|where should|hidden gems|gems|places to visit|things to do|attractions|must visit|worth visiting)\b/.test(
          lowercasePrompt,
        ),
      isReview: /\b(review|rating|opinion|experience|feedback)\b/.test(
        lowercasePrompt,
      ),
      isPricing: /\b(price|cost|expensive|cheap|budget|fee|rate)\b/.test(
        lowercasePrompt,
      ),
    },

    // Dynamic content indicators
    dynamic: {
      needsRealTime: /\b(weather|traffic|stock|news|breaking|live)\b/.test(
        lowercasePrompt,
      ),
      isMarketRelated:
        /\b(market|economy|trends|job|hiring|salary|housing|rent)\b/.test(
          lowercasePrompt,
        ),
      isTechnology: /\b(latest|new|update|version|release|feature)\b/.test(
        lowercasePrompt,
      ),
    },

    // Query complexity and scope
    complexity: {
      isOpenEnded: prompt.includes('?') && prompt.length > 50,
      hasMultipleParts:
        (prompt.match(/\?/g) || []).length > 1 || prompt.includes(' and '),
      isSpecific: /\b(exactly|specifically|precise|particular)\b/.test(
        lowercasePrompt,
      ),
    },
  };
}

/**
 * Determines urgency level of the query
 */
function getUrgencyLevel(prompt: string): 'low' | 'medium' | 'high' {
  if (/\b(urgent|immediately|asap|right now|emergency)\b/.test(prompt))
    return 'high';
  if (/\b(soon|today|this week|current|latest)\b/.test(prompt)) return 'medium';
  return 'low';
}

/**
 * Extracts location mentions from the prompt
 */
function extractLocationMentions(prompt: string): string[] {
  const locationPattern =
    /\b(in|at|near|around|close to|within)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  match = locationPattern.exec(prompt);
  while (match !== null) {
    matches.push(match[2]);
    match = locationPattern.exec(prompt);
  }

  return matches;
}

/**
 * Makes intelligent decision about web search necessity
 */
function makeIntelligentDecision(
  analysis: ReturnType<typeof analyzeQueryIntent>,
  contextualHints?: any,
): boolean {
  let score = 0;
  const reasons = [];

  // Temporal factors (strong indicators)
  if (analysis.temporal.isTimeSpecific) {
    score += 40;
    reasons.push('time-specific query');
  }

  if (analysis.temporal.urgencyLevel === 'high') {
    score += 35;
    reasons.push('high urgency');
  } else if (analysis.temporal.urgencyLevel === 'medium') {
    score += 20;
    reasons.push('medium urgency');
  }

  if (analysis.temporal.isEventBased) {
    score += 30;
    reasons.push('event-based query');
  }

  // Location + recommendation combo (very strong for local info)
  if (
    analysis.location.hasLocation &&
    analysis.informationType.isRecommendation
  ) {
    score += 45;
    reasons.push('location-specific recommendation');
  }

  if (analysis.location.hasLocation && analysis.informationType.isReview) {
    score += 40;
    reasons.push('location-specific reviews');
  }

  // Dynamic content needs
  if (analysis.dynamic.needsRealTime) {
    score += 50;
    reasons.push('real-time data needed');
  }

  if (analysis.dynamic.isMarketRelated) {
    score += 35;
    reasons.push('market information');
  }

  // Information type factors
  if (analysis.informationType.isComparative && analysis.location.hasLocation) {
    score += 30;
    reasons.push('location-based comparison');
  }

  if (analysis.informationType.isPricing && analysis.temporal.isTimeSpecific) {
    score += 35;
    reasons.push('current pricing information');
  }

  // Context-based adjustments
  if (contextualHints?.lastWebSearch) {
    const timeSinceLastSearch =
      Date.now() - contextualHints.lastWebSearch.getTime();
    if (timeSinceLastSearch < 300000) {
      // 5 minutes
      score += 15;
      reasons.push('recent web search context');
    }
  }

  if (
    contextualHints?.recentTopics?.some((topic: string) =>
      analysis.location.specificPlace.some((place: string) =>
        place.toLowerCase().includes(topic.toLowerCase()),
      ),
    )
  ) {
    score += 10;
    reasons.push('topic continuity');
  }

  // Penalties for static/factual queries
  if (analysis.informationType.isFactual && !analysis.temporal.isTimeSpecific) {
    score -= 20;
    reasons.push('static factual query (penalty)');
  }

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `🔍 Web search decision for "${prompt}": score=${score}, reasons=[${reasons.join(', ')}]`,
    );
    console.log('📊 Analysis:', {
      temporal: analysis.temporal,
      location: analysis.location,
      informationType: analysis.informationType,
      dynamic: analysis.dynamic,
    });
  }

  // Decision threshold: 25+ suggests web search is beneficial
  return score >= 25;
}

/**
 * Enhanced query for better web search results with contextual awareness
 */
export function enhanceSearchQuery(
  originalQuery: string,
  userPreferences?: any,
): string {
  let enhancedQuery = originalQuery;

  // Add location context if user has discussed cities
  if (userPreferences?.discussedCities?.length > 0) {
    const cities = userPreferences.discussedCities.slice(0, 2).join(' OR ');
    enhancedQuery = `${originalQuery} ${cities}`;
  }

  // Add career context for job-related searches
  if (
    userPreferences?.careerField &&
    (originalQuery.toLowerCase().includes('job') ||
      originalQuery.toLowerCase().includes('career') ||
      originalQuery.toLowerCase().includes('salary'))
  ) {
    enhancedQuery = `${enhancedQuery} ${userPreferences.careerField}`;
  }

  // Add relocation context
  if (
    originalQuery.toLowerCase().includes('city') ||
    originalQuery.toLowerCase().includes('move') ||
    originalQuery.toLowerCase().includes('relocat')
  ) {
    enhancedQuery = `${enhancedQuery} city relocation moving`;
  }

  return enhancedQuery;
}
