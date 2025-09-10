import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import {
  getConversationSummary,
  updateConversationSummary,
  getUserPreferences,
  needsMemoryRepair,
  repairMemoryResponse,
  getEnhancedContext,
  updateWebSearchTimestamp,
} from '@/lib/ai/memory';
import { needsWebSearch } from '@/lib/ai/web-search-utils';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { webSearch } from '@/lib/ai/tools/web-search';
import { localVectorSearch } from '@/lib/ai/tools/local-vector-search';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Get enhanced context with memory and adaptive intelligence
    const enhancedContext = getEnhancedContext(session.user.id);
    const userPreferences = getUserPreferences(session.user.id);
    const conversationSummary = getConversationSummary(session.user.id);

    // Enhanced web search detection with contextual awareness
    const userMessage =
      message.parts?.find((part) => part.type === 'text')?.text || '';

    const shouldUseWebSearch = needsWebSearch(userMessage, {
      recentTopics: enhancedContext.recentTopics,
      urgentQueries: conversationSummary?.urgentQueries,
      lastWebSearch: enhancedContext.memory?.lastWebSearchTimestamp,
      userPreferences,
      conversationContext: enhancedContext.recentTopics || [],
    });

    // Enhanced system prompt with contextual intelligence
    const enhancedRequestHints = {
      ...requestHints,
      userPreferences,
      conversationSummary: conversationSummary?.summary,
      contextualPrompts: enhancedContext.contextualPrompts,
      recentTopics: enhancedContext.recentTopics,
      shouldPrioritizeWebSearch: shouldUseWebSearch,
      adaptiveContext: enhancedContext.memory?.adaptivePrompts || [],
    };

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        // Update web search timestamp if web search is prioritized
        if (shouldUseWebSearch) {
          updateWebSearchTimestamp(session.user.id);
        }

        // Intelligent tool selection based on context
        const availableTools =
          selectedChatModel === 'chat-model-reasoning'
            ? []
            : [
                'getWeather' as const,
                'localVectorSearch' as const,
                ...(shouldUseWebSearch ? ['webSearch' as const] : []),
              ];

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({
            selectedChatModel,
            requestHints: enhancedRequestHints,
          }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: availableTools,
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            webSearch,
            localVectorSearch,
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        // Save messages to database
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        // Update conversation memory with new messages
        try {
          const lastUserMessage = messages.find((m) => m.role === 'user');
          const lastAssistantMessage = messages.find(
            (m) => m.role === 'assistant',
          );

          if (lastUserMessage && lastAssistantMessage) {
            // Get text content from message parts
            const userText =
              lastUserMessage.parts?.find((p) => p.type === 'text')?.text || '';
            const assistantText =
              lastAssistantMessage.parts?.find((p) => p.type === 'text')
                ?.text || '';

            // Convert previous messages to the format expected by memory function
            const previousMessages = messagesFromDb.map((msg) => ({
              role: msg.role,
              content:
                Array.isArray(msg.parts) && msg.parts.length > 0
                  ? (msg.parts[0] as any)?.text || ''
                  : '',
            }));

            // Check if response needs memory repair
            if (needsMemoryRepair(assistantText)) {
              console.log('🔧 Memory repair needed for user:', session.user.id);

              const repairedResponse = await repairMemoryResponse(
                session.user.id,
                userText,
                assistantText,
              );

              // Note: In a real implementation, you might want to send the repaired response
              // This is a simplified version for demonstration
              console.log('✅ Memory repaired for user:', session.user.id);
            }

            // Update conversation summary
            await updateConversationSummary(
              session.user.id,
              userText,
              assistantText,
              previousMessages,
            );
          }
        } catch (error) {
          console.error('Error updating conversation memory:', error);
          // Don't fail the request if memory update fails
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    console.error('Chat API error:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    // Handle any other errors with a generic bad_request
    return new ChatSDKError('bad_request:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
