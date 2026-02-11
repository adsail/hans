import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('whatsapp-client');

export interface WhatsAppClientConfig {
  sessionPath: string;
}

export function createWhatsAppClient(config: WhatsAppClientConfig): Client {
  logger.info('Creating WhatsApp client', { sessionPath: config.sessionPath });

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.sessionPath,
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', (qr) => {
    logger.info('QR Code received. Scan it with your WhatsApp app:');
    console.log('\n' + '='.repeat(60));
    console.log('SCAN THIS QR CODE WITH WHATSAPP:');
    console.log('='.repeat(60) + '\n');

    // Generate ASCII QR code in terminal
    qrcode.generate(qr, { small: true });

    console.log('\n' + '='.repeat(60) + '\n');
  });

  client.on('ready', () => {
    logger.info('WhatsApp client is ready!');
  });

  client.on('authenticated', () => {
    logger.info('WhatsApp client authenticated');
  });

  client.on('auth_failure', (message) => {
    logger.error('WhatsApp authentication failed', { message });
  });

  client.on('disconnected', (reason) => {
    logger.warn('WhatsApp client disconnected', { reason });
  });

  return client;
}
