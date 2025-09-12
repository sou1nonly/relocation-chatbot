/**
 * Enhanced Context Assembly System
 * Combines memory, user profile, and web results into unified, token-optimized prompts
 */

import type { QueryIntent, UserContext } from './intent-classifier';
import type { ScoredResult, FilteredResults } from './semantic-filter';

export interface MemoryContext {
  preferences: Array<{
    key: string;
    value: string;
    confidence: number;
    lastUpdated: Date;
  }>;
  facts: Array<{
    content: string;
    relevance: number;
    source: string;
    timestamp: Date;
  }>;
  summaries: Array<{
    topic: string;
    summary: string;
    keyPoints: string[];
    timestamp: Date;
  }>;
  comparisons: Array<{
    cities: string[];
    criteria: string;
    conclusion: string;
    timestamp: Date;
  }>;
}

export interface AssembledContext {
  // Core context sections
  userProfile: string;
  relevantMemory: string;
  webResults: string;
  conversationContext: string;

  // Metadata
  totalTokens: number;
  compressionRatio: number;
  contextSources: string[];
  confidenceScore: number;

  // Context management
  prioritizedSections: Array<{
    section: string;
    priority: number;
    tokenCount: number;
  }>;

  // Optimization details
  optimizations: string[];
  warnings: string[];
}

export interface ContextAssemblyOptions {
  maxTokens: number;
  preserveUserContext: boolean;
  prioritizeRecent: boolean;
  includeWebResults: boolean;
  compressionLevel: 'none' | 'light' | 'moderate' | 'aggressive';
  focusAreas: string[];
}

export class ContextAssembler {
  private readonly defaultOptions: ContextAssemblyOptions = {
    maxTokens: 4000,
    preserveUserContext: true,
    prioritizeRecent: true,
    includeWebResults: true,
    compressionLevel: 'moderate',
    focusAreas: [],
  };

  private readonly sectionPriorities = {
    userQuery: 100,
    userProfile: 90,
    recentPreferences: 85,
    webResults: 80,
    relevantFacts: 75,
    conversationHistory: 70,
    summaries: 65,
    comparisons: 60,
    generalMemory: 50,
  };

  /**
   * Assemble comprehensive context from multiple sources
   */
  assembleContext(
    userQuery: string,
    intent: QueryIntent,
    userContext: UserContext,
    memoryContext: MemoryContext,
    webResults?: FilteredResults,
    options: Partial<ContextAssemblyOptions> = {},
  ): AssembledContext {
    const opts = { ...this.defaultOptions, ...options };
    const sections: Array<{
      name: string;
      content: string;
      priority: number;
      tokens: number;
    }> = [];

    // Build user profile section
    const userProfile = this.buildUserProfile(userContext, intent, opts);
    sections.push({
      name: 'userProfile',
      content: userProfile,
      priority: this.sectionPriorities.userProfile,
      tokens: this.estimateTokens(userProfile),
    });

    // Build memory sections
    const memorySection = this.buildMemorySection(memoryContext, intent, opts);
    sections.push({
      name: 'relevantMemory',
      content: memorySection,
      priority: this.sectionPriorities.relevantFacts,
      tokens: this.estimateTokens(memorySection),
    });

    // Build web results section
    let webResultsSection = '';
    if (opts.includeWebResults && webResults?.results.length) {
      webResultsSection = this.buildWebResultsSection(webResults, intent, opts);
      sections.push({
        name: 'webResults',
        content: webResultsSection,
        priority: this.sectionPriorities.webResults,
        tokens: this.estimateTokens(webResultsSection),
      });
    }

    // Build conversation context
    const conversationSection = this.buildConversationSection(
      userContext,
      opts,
    );
    sections.push({
      name: 'conversationContext',
      content: conversationSection,
      priority: this.sectionPriorities.conversationHistory,
      tokens: this.estimateTokens(conversationSection),
    });

    // Optimize sections to fit token budget
    const optimizedSections = this.optimizeSections(sections, opts);

    // Calculate metadata
    const totalTokens = optimizedSections.reduce((sum, s) => sum + s.tokens, 0);
    const originalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);
    const compressionRatio =
      originalTokens > 0 ? totalTokens / originalTokens : 1;

    // Generate final context sections
    const finalUserProfile =
      optimizedSections.find((s) => s.name === 'userProfile')?.content || '';
    const finalMemory =
      optimizedSections.find((s) => s.name === 'relevantMemory')?.content || '';
    const finalWebResults =
      optimizedSections.find((s) => s.name === 'webResults')?.content || '';
    const finalConversation =
      optimizedSections.find((s) => s.name === 'conversationContext')
        ?.content || '';

    return {
      userProfile: finalUserProfile,
      relevantMemory: finalMemory,
      webResults: finalWebResults,
      conversationContext: finalConversation,
      totalTokens,
      compressionRatio,
      contextSources: optimizedSections.map((s) => s.name),
      confidenceScore: this.calculateContextConfidence(
        optimizedSections,
        intent,
      ),
      prioritizedSections: optimizedSections.map((s) => ({
        section: s.name,
        priority: s.priority,
        tokenCount: s.tokens,
      })),
      optimizations: this.getOptimizationDetails(
        sections,
        optimizedSections,
        opts,
      ),
      warnings: this.generateWarnings(optimizedSections, opts),
    };
  }

  private buildUserProfile(
    userContext: UserContext,
    intent: QueryIntent,
    options: ContextAssemblyOptions,
  ): string {
    const profile: string[] = [];

    if (userContext.currentLocation) {
      profile.push(`Current location: ${userContext.currentLocation}`);
    }

    if (userContext.targetCities?.length) {
      profile.push(
        `Cities considering: ${userContext.targetCities.join(', ')}`,
      );
    }

    if (userContext.preferences?.careerField) {
      profile.push(`Career: ${userContext.preferences.careerField}`);
    }

    if (userContext.preferences?.priorities?.length) {
      const priorities = userContext.preferences.priorities.slice(0, 5);
      profile.push(`Priorities: ${priorities.join(', ')}`);
    }

    if (userContext.preferences?.lifestyle?.length) {
      const lifestyle = userContext.preferences.lifestyle.slice(0, 3);
      profile.push(`Lifestyle preferences: ${lifestyle.join(', ')}`);
    }

    if (profile.length === 0) {
      return 'User profile: New user, no established preferences yet.';
    }

    return `User profile:\n${profile.join('\n')}`;
  }

  private buildMemorySection(
    memory: MemoryContext,
    intent: QueryIntent,
    options: ContextAssemblyOptions,
  ): string {
    const sections: string[] = [];

    // Prioritize preferences that match current query
    const relevantPreferences = memory.preferences
      .filter((pref) => this.isRelevantToIntent(pref.key, intent))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    if (relevantPreferences.length > 0) {
      const prefTexts = relevantPreferences.map(
        (pref) => `${pref.key}: ${pref.value}`,
      );
      sections.push(`Preferences:\n${prefTexts.join('\n')}`);
    }

    // Add relevant facts
    const relevantFacts = memory.facts
      .filter((fact) => this.isFactRelevant(fact, intent))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8);

    if (relevantFacts.length > 0) {
      const factTexts = relevantFacts.map((fact) => `- ${fact.content}`);
      sections.push(`Relevant information:\n${factTexts.join('\n')}`);
    }

    // Add summaries if they match the topic
    const relevantSummaries = memory.summaries
      .filter((summary) => this.isSummaryRelevant(summary, intent))
      .slice(0, 2);

    if (relevantSummaries.length > 0) {
      relevantSummaries.forEach((summary) => {
        sections.push(`${summary.topic} summary: ${summary.summary}`);
      });
    }

    // Add relevant comparisons
    const relevantComparisons = memory.comparisons
      .filter((comp) => this.isComparisonRelevant(comp, intent))
      .slice(0, 3);

    if (relevantComparisons.length > 0) {
      relevantComparisons.forEach((comp) => {
        sections.push(
          `Comparison (${comp.cities.join(' vs ')}): ${comp.conclusion}`,
        );
      });
    }

    if (sections.length === 0) {
      return 'No relevant memory found.';
    }

    return sections.join('\n\n');
  }

  private buildWebResultsSection(
    webResults: FilteredResults,
    intent: QueryIntent,
    options: ContextAssemblyOptions,
  ): string {
    if (!webResults.results.length) {
      return 'No web search results available.';
    }

    const sections: string[] = [];

    // Summary of search
    sections.push(
      `Web search found ${webResults.results.length} relevant results:`,
    );

    // Top results with compression based on options
    const maxResults = this.getMaxWebResults(options.compressionLevel);
    const topResults = webResults.results.slice(0, maxResults);

    topResults.forEach((result, index) => {
      const compressed = this.compressWebResult(
        result,
        options.compressionLevel,
      );
      sections.push(`${index + 1}. ${compressed}`);
    });

    // Add search insights if weak results
    if (webResults.summary.weakResults) {
      sections.push(
        `Note: Search results have moderate confidence. Consider refining search terms.`,
      );
    }

    return sections.join('\n');
  }

  private buildConversationSection(
    userContext: UserContext,
    options: ContextAssemblyOptions,
  ): string {
    if (!userContext.conversationHistory?.length) {
      return 'No recent conversation context.';
    }

    const maxMessages = options.prioritizeRecent ? 6 : 4;
    const recentHistory = userContext.conversationHistory.slice(-maxMessages);

    if (options.compressionLevel === 'aggressive') {
      // Summarize conversation history
      const topics = recentHistory
        .join(' ')
        .split(' ')
        .filter((word) => word.length > 4)
        .slice(0, 10);
      return `Recent topics discussed: ${topics.join(', ')}`;
    }

    return `Recent conversation:\n${recentHistory.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`;
  }

  private optimizeSections(
    sections: Array<{
      name: string;
      content: string;
      priority: number;
      tokens: number;
    }>,
    options: ContextAssemblyOptions,
  ): Array<{
    name: string;
    content: string;
    priority: number;
    tokens: number;
  }> {
    // Sort by priority
    const sorted = [...sections].sort((a, b) => b.priority - a.priority);

    let totalTokens = 0;
    const optimized: typeof sections = [];

    for (const section of sorted) {
      if (totalTokens + section.tokens <= options.maxTokens) {
        // Section fits as-is
        optimized.push(section);
        totalTokens += section.tokens;
      } else if (totalTokens < options.maxTokens * 0.9) {
        // Try to compress section to fit
        const remainingTokens = options.maxTokens - totalTokens;
        const compressionRatio = remainingTokens / section.tokens;

        if (compressionRatio > 0.3) {
          // Don't compress more than 70%
          const compressedContent = this.compressContent(
            section.content,
            compressionRatio,
          );
          const compressedTokens = this.estimateTokens(compressedContent);

          optimized.push({
            ...section,
            content: compressedContent,
            tokens: compressedTokens,
          });
          totalTokens += compressedTokens;
        }
      }
    }

    return optimized;
  }

  private compressContent(content: string, ratio: number): string {
    if (ratio >= 0.8) return content; // Minimal compression needed

    const lines = content.split('\n');
    const targetLines = Math.max(1, Math.floor(lines.length * ratio));

    // Keep most important lines (headers, first lines of sections)
    const important = lines.filter(
      (line) =>
        line.includes(':') ||
        line.startsWith('-') ||
        line.startsWith('•') ||
        line.length < 50,
    );

    const remaining = lines.filter((line) => !important.includes(line));
    const selectedRemaining = remaining.slice(
      0,
      targetLines - important.length,
    );

    return [...important, ...selectedRemaining].join('\n');
  }

  private compressWebResult(
    result: ScoredResult,
    compressionLevel: string,
  ): string {
    switch (compressionLevel) {
      case 'aggressive':
        return `${result.title} (Score: ${result.finalScore.toFixed(2)})`;

      case 'moderate':
        return `${result.title}: ${result.snippet.substring(0, 100)}... (Score: ${result.finalScore.toFixed(2)})`;

      case 'light':
        return `${result.title}: ${result.snippet.substring(0, 150)}... [${result.domain}]`;

      default:
        return `${result.title}: ${result.snippet} [${result.link}]`;
    }
  }

  private getMaxWebResults(compressionLevel: string): number {
    switch (compressionLevel) {
      case 'aggressive':
        return 3;
      case 'moderate':
        return 5;
      case 'light':
        return 6;
      default:
        return 8;
    }
  }

  private calculateContextConfidence(
    sections: Array<{
      name: string;
      content: string;
      priority: number;
      tokens: number;
    }>,
    intent: QueryIntent,
  ): number {
    let confidence = 0.5;

    // Boost confidence based on available context
    sections.forEach((section) => {
      switch (section.name) {
        case 'userProfile':
          if (section.tokens > 50) confidence += 0.15;
          break;
        case 'relevantMemory':
          if (section.tokens > 100) confidence += 0.2;
          break;
        case 'webResults':
          if (section.tokens > 200) confidence += 0.25;
          break;
        case 'conversationContext':
          if (section.tokens > 80) confidence += 0.1;
          break;
      }
    });

    // Adjust for intent confidence
    confidence += intent.confidence.needsWebSearch * 0.1;
    confidence += intent.confidence.personalRelevance * 0.1;

    return Math.min(1.0, confidence);
  }

  private getOptimizationDetails(
    original: Array<{ tokens: number }>,
    optimized: Array<{ tokens: number }>,
    options: ContextAssemblyOptions,
  ): string[] {
    const details: string[] = [];

    const originalTokens = original.reduce((sum, s) => sum + s.tokens, 0);
    const optimizedTokens = optimized.reduce((sum, s) => sum + s.tokens, 0);

    if (optimizedTokens < originalTokens) {
      const reduction = (
        ((originalTokens - optimizedTokens) / originalTokens) *
        100
      ).toFixed(1);
      details.push(`Reduced content by ${reduction}% to fit token budget`);
    }

    if (optimized.length < original.length) {
      details.push(
        `Filtered ${original.length - optimized.length} low-priority sections`,
      );
    }

    if (options.compressionLevel !== 'none') {
      details.push(`Applied ${options.compressionLevel} compression`);
    }

    return details;
  }

  private generateWarnings(
    sections: Array<{ name: string; tokens: number }>,
    options: ContextAssemblyOptions,
  ): string[] {
    const warnings: string[] = [];

    const totalTokens = sections.reduce((sum, s) => sum + s.tokens, 0);

    if (totalTokens > options.maxTokens * 0.95) {
      warnings.push(
        'Context is near token limit, some information may be truncated',
      );
    }

    if (!sections.find((s) => s.name === 'webResults' && s.tokens > 0)) {
      warnings.push('No web search results included in context');
    }

    if (!sections.find((s) => s.name === 'userProfile' && s.tokens > 20)) {
      warnings.push('Limited user profile information available');
    }

    return warnings;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  // Relevance checking methods
  private isRelevantToIntent(
    preferenceKey: string,
    intent: QueryIntent,
  ): boolean {
    const keyLower = preferenceKey.toLowerCase();
    return intent.entities.topics.some(
      (topic) => keyLower.includes(topic) || topic.includes(keyLower),
    );
  }

  private isFactRelevant(
    fact: MemoryContext['facts'][0],
    intent: QueryIntent,
  ): boolean {
    const factLower = fact.content.toLowerCase();
    return (
      intent.entities.topics.some((topic) => factLower.includes(topic)) ||
      intent.entities.locations.some((location) =>
        factLower.includes(location.toLowerCase()),
      )
    );
  }

  private isSummaryRelevant(
    summary: MemoryContext['summaries'][0],
    intent: QueryIntent,
  ): boolean {
    const topicLower = summary.topic.toLowerCase();
    return intent.entities.topics.some(
      (topic) => topicLower.includes(topic) || topic.includes(topicLower),
    );
  }

  private isComparisonRelevant(
    comparison: MemoryContext['comparisons'][0],
    intent: QueryIntent,
  ): boolean {
    return comparison.cities.some((city) =>
      intent.entities.locations.some((location) =>
        location.toLowerCase().includes(city.toLowerCase()),
      ),
    );
  }
}
