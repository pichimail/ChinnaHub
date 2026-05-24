import type { PlatformDefinition } from '../types';
import { WhatsAppClientFactory } from './client';
import { schema } from './schema';

export const whatsapp: PlatformDefinition = {
  id: 'whatsapp',
  name: 'WhatsApp',
  connectionMode: 'polling',
  description:
    'Connect WhatsApp with QR login. Cloud API credentials remain supported for legacy channels.',
  documentation: {
    portalUrl: 'https://developers.facebook.com/apps/',
    setupGuideUrl: 'https://lobehub.com/docs/usage/channels/whatsapp',
  },
  schema,
  showWebhookUrl: false,
  supportsMarkdown: false,
  supportsMessageEdit: false,
  clientFactory: new WhatsAppClientFactory(),
};
