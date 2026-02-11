import { createLogger } from '../utils/logger.js';

const logger = createLogger('command-parser');

export interface ParsedCommand {
  raw: string;
  normalized: string;
  isCommand: boolean;
}

// Common greetings and non-commands to filter out
const NON_COMMANDS = [
  /^(hi|hello|hey|yo|sup|what'?s up)/i,
  /^(thanks|thank you|thx)/i,
  /^(ok|okay|k|sure|got it)/i,
];

export function parseCommand(message: string): ParsedCommand {
  const raw = message;
  const normalized = message.trim().toLowerCase();

  // Check if this looks like a command
  const isCommand = !NON_COMMANDS.some(pattern => pattern.test(normalized));

  logger.debug('Parsed command', { raw, normalized, isCommand });

  return {
    raw,
    normalized,
    isCommand,
  };
}

export function extractItemName(message: string, prefix: string): string | null {
  const prefixPattern = new RegExp(`^${prefix}\\s+`, 'i');
  if (!prefixPattern.test(message)) {
    return null;
  }

  return message.replace(prefixPattern, '').trim();
}
