import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { google } from '@ai-sdk/google';
import { chatModel, reasoningModel, titleModel } from './models.test';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': google('gemini-1.5-flash'), // Using Google Gemini Flash
        'chat-model-reasoning': wrapLanguageModel({
          model: google('gemini-1.5-flash'), // Using Gemini Flash for reasoning
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': google('gemini-1.5-flash'), // Using Gemini Flash for titles
      },
      imageModels: {
        'small-model': google.imageModel('imagen-3.0-generate-001'),
      },
    });
