import { vi } from 'vitest';

export interface MockFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface MockGeminiResponse {
  text?: string;
  functionCalls?: MockFunctionCall[];
}

export function createMockGeminiService() {
  const responses: MockGeminiResponse[] = [];
  let responseIndex = 0;

  const mockService = {
    chat: vi.fn().mockImplementation(async (_userId: string, _message: string) => {
      if (responseIndex < responses.length) {
        return responses[responseIndex++];
      }
      return { text: 'No mock response configured' };
    }),

    addFunctionResult: vi.fn(),

    continueWithFunctionResults: vi.fn().mockImplementation(async () => {
      if (responseIndex < responses.length) {
        return responses[responseIndex++];
      }
      return { text: 'Done!' };
    }),

    clearHistory: vi.fn(),

    // Test helpers
    _setResponses: (newResponses: MockGeminiResponse[]) => {
      responses.length = 0;
      responses.push(...newResponses);
      responseIndex = 0;
    },

    _reset: () => {
      responses.length = 0;
      responseIndex = 0;
      mockService.chat.mockClear();
      mockService.addFunctionResult.mockClear();
      mockService.continueWithFunctionResults.mockClear();
      mockService.clearHistory.mockClear();
    },
  };

  return mockService;
}

export type MockGeminiService = ReturnType<typeof createMockGeminiService>;
