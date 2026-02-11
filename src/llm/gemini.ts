import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Content,
  type Part,
} from '@google/generative-ai';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('gemini');

// Define the tools Hans can use
const tools: FunctionDeclaration[] = [
  {
    name: 'add_to_grocery_list',
    description: 'Add one or more items to the Wegmans shopping list. Searches past purchases first for quick matching, then falls back to full catalog search.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        items: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'List of items to add (e.g., ["milk", "eggs", "bread"])',
        },
      },
      required: ['items'],
    },
  },
  {
    name: 'search_grocery_item',
    description: 'Search the full Wegmans catalog for an item, skipping past purchases. Use this when the user wants to find something new or specific.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Search query for the item',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'remove_from_grocery_list',
    description: 'Remove an item from the shopping list',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        item: {
          type: SchemaType.STRING,
          description: 'Name of the item to remove',
        },
      },
      required: ['item'],
    },
  },
  {
    name: 'show_grocery_list',
    description: 'Show the current shopping list',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'clear_grocery_list',
    description: 'Clear all items from the shopping list',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'select_item',
    description: 'Select an item from the previously shown options by number',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        selection: {
          type: SchemaType.INTEGER,
          description: 'The number of the item to select (1-based)',
        },
      },
      required: ['selection'],
    },
  },
];

const SYSTEM_PROMPT = `You are Hans, a friendly and helpful personal assistant that manages a Wegmans grocery shopping list via WhatsApp.

Your personality:
- Casual and conversational, but efficient
- Use short responses - this is WhatsApp, not email
- Confirm actions briefly ("Added milk!" not "I have successfully added milk to your shopping list.")
- Be helpful with suggestions when relevant

Your capabilities:
- Add items to the Wegmans shopping list (can add multiple at once)
- Remove items from the list
- Show the current list
- Clear the entire list
- Search for specific products

Important behaviors:
- When users mention multiple items, add them all in one go
- If a search returns multiple options, present them and wait for the user to pick
- Remember context - if user says "add that one" after seeing options, use select_item
- Be proactive - if adding "milk" and user often buys organic, mention it
- Keep responses concise for mobile reading

Examples of natural language you should understand:
- "add eggs and milk" → add_to_grocery_list with ["eggs", "milk"]
- "I need bananas for tomorrow" → add_to_grocery_list with ["bananas"]
- "what's on my list?" → show_grocery_list
- "remove the eggs" → remove_from_grocery_list with "eggs"
- "pick 2" or "the second one" → select_item with 2
- "never mind, clear it" → clear_grocery_list
- "find organic almond milk" → search_grocery_item with "organic almond milk"`;

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LLMResponse {
  text?: string;
  functionCalls?: FunctionCall[];
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private conversationHistory: Map<string, Content[]> = new Map();

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-1.5-flash';
    logger.info('Gemini service initialized', { model: this.model });
  }

  async chat(userId: string, message: string): Promise<LLMResponse> {
    logger.info('Processing message', { userId, message });

    // Get or create conversation history for this user
    let history = this.conversationHistory.get(userId) || [];

    // Keep history manageable (last 20 turns)
    if (history.length > 40) {
      history = history.slice(-40);
    }

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: tools }],
    });

    const chat = model.startChat({ history });

    try {
      const result = await chat.sendMessage(message);
      const response = result.response;

      // Update history
      history.push({ role: 'user', parts: [{ text: message }] });

      const responseParts: Part[] = [];
      const functionCalls: FunctionCall[] = [];

      // Check for function calls
      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args as Record<string, unknown>,
            });
            responseParts.push(part);
          } else if (part.text) {
            responseParts.push(part);
          }
        }
      }

      // Add response to history
      if (responseParts.length > 0) {
        history.push({ role: 'model', parts: responseParts });
      }

      this.conversationHistory.set(userId, history);

      const text = response.text();
      logger.info('Gemini response', {
        hasText: !!text,
        functionCallCount: functionCalls.length,
      });

      return {
        text: text || undefined,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };
    } catch (error) {
      logger.error('Gemini API error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  addFunctionResult(userId: string, functionName: string, result: string): void {
    const history = this.conversationHistory.get(userId) || [];

    history.push({
      role: 'function' as const,
      parts: [{
        functionResponse: {
          name: functionName,
          response: { result },
        },
      }],
    });

    this.conversationHistory.set(userId, history);
  }

  async continueWithFunctionResults(userId: string): Promise<LLMResponse> {
    const history = this.conversationHistory.get(userId) || [];

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: tools }],
    });

    const chat = model.startChat({ history });

    try {
      // Send empty message to get model's response after function results
      const result = await chat.sendMessage('');
      const response = result.response;

      const text = response.text();
      const functionCalls: FunctionCall[] = [];

      const candidates = response.candidates;
      if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args as Record<string, unknown>,
            });
          }
        }

        // Update history with model response
        history.push({ role: 'model', parts: candidates[0].content.parts });
        this.conversationHistory.set(userId, history);
      }

      return {
        text: text || undefined,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      };
    } catch (error) {
      logger.error('Gemini continue error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  clearHistory(userId: string): void {
    this.conversationHistory.delete(userId);
    logger.info('Cleared conversation history', { userId });
  }
}
