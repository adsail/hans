import type { Client, Message } from 'whatsapp-web.js';
import type { HansAgent } from '../llm/agent.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('message-handler');

export interface MessageHandlerConfig {
  ownerPhoneNumber: string;
}

export function setupMessageHandler(
  client: Client,
  agent: HansAgent,
  config: MessageHandlerConfig
): void {
  logger.info('Setting up message handler', {
    ownerNumber: config.ownerPhoneNumber
  });

  client.on('message', async (message: Message) => {
    // Only process messages from the owner
    if (message.from !== config.ownerPhoneNumber) {
      logger.debug('Ignoring message from non-owner', { from: message.from });
      return;
    }

    // Ignore group messages
    if (message.from.includes('@g.us')) {
      logger.debug('Ignoring group message');
      return;
    }

    // Ignore empty messages
    if (!message.body || !message.body.trim()) {
      logger.debug('Ignoring empty message');
      return;
    }

    const userMessage = message.body.trim();
    logger.info('Received message from owner', {
      body: userMessage.substring(0, 100)
    });

    try {
      // Handle special commands that bypass the agent
      if (userMessage.toLowerCase() === '/reset') {
        agent.clearContext(message.from);
        await message.reply("Context cleared! Let's start fresh.");
        return;
      }

      // Process through the agent
      const response = await agent.handleMessage(message.from, userMessage);

      // Send the response back
      await message.reply(response);

      logger.info('Sent response', {
        responseLength: response.length
      });
    } catch (error) {
      logger.error('Error processing message', {
        error: error instanceof Error ? error.message : String(error)
      });

      try {
        await message.reply(
          'Sorry, something went wrong. Please try again.'
        );
      } catch (replyError) {
        logger.error('Failed to send error reply', {
          error: replyError instanceof Error ? replyError.message : String(replyError)
        });
      }
    }
  });

  // Handle message acknowledgement
  client.on('message_ack', (message: Message, ack: number) => {
    const ackStatus = ['PENDING', 'SERVER', 'DEVICE', 'READ', 'PLAYED'];
    logger.debug('Message ack', {
      status: ackStatus[ack] || 'UNKNOWN'
    });
  });
}
