import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import { DEFAULT_MODEL } from '@lobechat/const';

import type { BuiltinAgentDefinition } from '../../types';
import { BUILTIN_AGENT_SLUGS } from '../../types';
import { systemRoleTemplate } from './systemRole';

export const ADMIN_ASSISTANT: BuiltinAgentDefinition = {
  avatar: '/avatars/lobe-ai.png',
  persist: {
    chatConfig: {
      enableAutoCreateTopic: false,
      enableHistoryCount: false,
    },
    model: DEFAULT_MODEL,
    provider: DEFAULT_PROVIDER,
  },
  runtime: (ctx) => ({
    chatConfig: {
      enableAutoCreateTopic: false,
      enableHistoryCount: false,
    },
    plugins: [...(ctx.plugins || [])],
    systemRole: systemRoleTemplate,
  }),
  slug: BUILTIN_AGENT_SLUGS.adminAssistant,
};
