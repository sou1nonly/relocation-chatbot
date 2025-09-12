import { auth } from '@/app/(auth)/auth';
import {
  getConversationSummary,
  getUserPreferences,
  getContextualMemory,
} from '@/lib/ai/memory';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all memory data
    const conversationSummary = getConversationSummary(userId);
    const userPreferences = getUserPreferences(userId);
    const contextualMemory = getContextualMemory(userId);

    const memoryData = {
      summary: conversationSummary?.summary || '',
      lastUpdated:
        conversationSummary?.lastUpdated?.toISOString() ||
        new Date().toISOString(),
      messageCount: conversationSummary?.messageCount || 0,
      keyTopics: conversationSummary?.keyTopics || [],
      urgentQueries: conversationSummary?.urgentQueries || [],
      locationContext: conversationSummary?.locationContext || [],
      userPreferences: {
        careerField: userPreferences?.careerField,
        discussedCities: userPreferences?.discussedCities,
        budget: userPreferences?.budget,
        workSetup: userPreferences?.workSetup,
        lifestyleNeeds: userPreferences?.lifestyleNeeds,
        familyRequirements: userPreferences?.familyRequirements,
      },
      contextualMemory: {
        recentSearches: contextualMemory?.recentSearches || [],
        adaptivePrompts: contextualMemory?.adaptivePrompts || [],
        lastWebSearchTimestamp:
          contextualMemory?.lastWebSearchTimestamp?.toISOString(),
      },
    };

    return Response.json({ memoryData });
  } catch (error) {
    console.error('Error fetching memory data:', error);
    return Response.json(
      { error: 'Failed to fetch memory data' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const updatedMemory = await request.json();

    // Import updateMemoryData dynamically to avoid circular imports
    const { updateMemoryData } = await import('@/lib/ai/memory');

    // Update the memory data
    await updateMemoryData(userId, updatedMemory);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating memory data:', error);
    return Response.json(
      { error: 'Failed to update memory data' },
      { status: 500 },
    );
  }
}
