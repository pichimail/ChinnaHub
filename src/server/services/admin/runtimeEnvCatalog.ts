import { fileEnv } from '@/envs/file';

export type RuntimeEnvCatalogItem = {
  description: string;
  domain: string;
  isSecret: boolean;
  key: string;
  requiredFor: string[];
};

export type RuntimeEnvCatalogRow = RuntimeEnvCatalogItem & {
  adminValueMasked?: string;
  hasAdminValue: boolean;
  hasProcessValue: boolean;
  issues: string[];
  processValueMasked?: string;
  source: 'admin' | 'missing' | 'process';
};

export const runtimeEnvCatalog: RuntimeEnvCatalogItem[] = [
  {
    description: 'Public canonical app URL used for auth callbacks, webhooks, and absolute links.',
    domain: 'global',
    isSecret: false,
    key: 'APP_URL',
    requiredFor: ['auth', 'video_webhooks', 'uploads'],
  },
  {
    description: 'Optional public webhook proxy URL. Must be HTTPS when video providers call back.',
    domain: 'video',
    isSecret: false,
    key: 'WEBHOOK_PROXY_URL',
    requiredFor: ['video_generation'],
  },
  {
    description: 'S3-compatible access key for browser uploads and generated media persistence.',
    domain: 'storage',
    isSecret: true,
    key: 'S3_ACCESS_KEY_ID',
    requiredFor: ['uploads', 'image_generation', 'video_generation', 'audio_generation'],
  },
  {
    description: 'S3-compatible secret key for file uploads.',
    domain: 'storage',
    isSecret: true,
    key: 'S3_SECRET_ACCESS_KEY',
    requiredFor: ['uploads', 'image_generation', 'video_generation', 'audio_generation'],
  },
  {
    description: 'S3 bucket name used by FileS3.',
    domain: 'storage',
    isSecret: false,
    key: 'S3_BUCKET',
    requiredFor: ['uploads', 'generated_media'],
  },
  {
    description: 'Browser-reachable HTTPS S3 endpoint used for presigned upload URLs.',
    domain: 'storage',
    isSecret: false,
    key: 'S3_ENDPOINT',
    requiredFor: ['uploads'],
  },
  {
    description: 'Public HTTPS media domain used to render stored files in the web app.',
    domain: 'storage',
    isSecret: false,
    key: 'S3_PUBLIC_DOMAIN',
    requiredFor: ['render_uploads', 'generated_media'],
  },
  {
    description: 'S3 region. Required by AWS S3 and some compatible providers.',
    domain: 'storage',
    isSecret: false,
    key: 'S3_REGION',
    requiredFor: ['uploads'],
  },
  {
    description: 'Set to 1 for MinIO/R2-style path addressing when required.',
    domain: 'storage',
    isSecret: false,
    key: 'S3_ENABLE_PATH_STYLE',
    requiredFor: ['uploads'],
  },
  {
    description: 'OpenRouter key for chat, image/video-capable OpenRouter models, and Lyria audio.',
    domain: 'ai',
    isSecret: true,
    key: 'OPENROUTER_API_KEY',
    requiredFor: ['openrouter_models', 'image_generation', 'video_generation', 'lyria_audio'],
  },
  {
    description: 'Optional explicit OpenRouter Lyria model id.',
    domain: 'audio',
    isSecret: false,
    key: 'OPENROUTER_LYRIA_MODEL',
    requiredFor: ['lyria_audio'],
  },
  {
    description: 'KIE/Suno-compatible music generation API key.',
    domain: 'audio',
    isSecret: true,
    key: 'KIE_AI_API_KEY',
    requiredFor: ['classic_audio'],
  },
  {
    description: 'OpenAI API key for OpenAI chat/image/video providers.',
    domain: 'ai',
    isSecret: true,
    key: 'OPENAI_API_KEY',
    requiredFor: ['openai_models', 'image_generation', 'video_generation'],
  },
  {
    description: 'Fal API key for image providers routed through Fal.',
    domain: 'image',
    isSecret: true,
    key: 'FAL_API_KEY',
    requiredFor: ['image_generation'],
  },
  {
    description: 'Black Forest Labs API key for image generation.',
    domain: 'image',
    isSecret: true,
    key: 'BFL_API_KEY',
    requiredFor: ['image_generation'],
  },
  {
    description: 'ComfyUI server URL for custom image workflows.',
    domain: 'image',
    isSecret: false,
    key: 'COMFYUI_BASE_URL',
    requiredFor: ['comfyui_image_generation'],
  },
  {
    description: 'ComfyUI API key when the server requires token auth.',
    domain: 'image',
    isSecret: true,
    key: 'COMFYUI_API_KEY',
    requiredFor: ['comfyui_image_generation'],
  },
];

const internalHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

export const maskValue = (value?: string | null) => {
  if (!value) return undefined;
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const getProcessValue = (key: string) => {
  if (key === 'S3_ENDPOINT') {
    return fileEnv.S3_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_S3_DOMAIN || process.env.S3_ENDPOINT;
  }

  if (key === 'S3_PUBLIC_DOMAIN') {
    return fileEnv.S3_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_S3_DOMAIN;
  }

  return process.env[key];
};

const isSecretLikeKey = (key: string) =>
  /_API_KEY|_TOKEN|_SECRET|SECRET_|TOKEN_|API_KEY|PRIVATE_KEY|KEY_VAULT/i.test(key);

const isRuntimeRelevantKey = (key: string) =>
  /^(?:APP_URL|INTERNAL_APP_URL|WEBHOOK_PROXY_URL|S3_|NEXT_PUBLIC_S3_|ENABLED_|OPENAI_|OPENROUTER_|ANTHROPIC_|GOOGLE_|AZURE_|AWS_|FAL_|BFL_|COMFYUI_|KIE_|V0_|VERCELAIGATEWAY_|CLOUDFLARE_|GITHUB_|MARKET_|AGENT_GATEWAY_|AUTH_|DATABASE_URL|REDIS_URL)/.test(
    key,
  );

const getExistingProcessEnvItems = (): RuntimeEnvCatalogItem[] => {
  const catalogKeys = new Set(runtimeEnvCatalog.map((item) => item.key));

  return Object.keys(process.env)
    .filter((key) => !catalogKeys.has(key) && isRuntimeRelevantKey(key))
    .sort()
    .map((key) => ({
      description: 'Existing runtime environment variable detected from process.env.',
      domain: key.startsWith('S3_') || key.startsWith('NEXT_PUBLIC_S3_') ? 'storage' : 'existing',
      isSecret: isSecretLikeKey(key),
      key,
      requiredFor: ['existing_runtime'],
    }));
};

const getHostIssues = (key: string, value?: string) => {
  if (!value) return [];

  const issues: string[] = [];
  try {
    const url = new URL(value);
    if (['APP_URL', 'S3_ENDPOINT', 'S3_PUBLIC_DOMAIN', 'WEBHOOK_PROXY_URL'].includes(key)) {
      if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
        issues.push('Production browser and webhook URLs must use HTTPS.');
      }

      if (
        ['S3_ENDPOINT', 'S3_PUBLIC_DOMAIN'].includes(key) &&
        (internalHostPatterns.some((pattern) => pattern.test(url.hostname)) ||
          !url.hostname.includes('.'))
      ) {
        issues.push('This host looks internal and cannot be reached by users browsers.');
      }
    }
  } catch {
    if (['APP_URL', 'S3_ENDPOINT', 'S3_PUBLIC_DOMAIN', 'WEBHOOK_PROXY_URL'].includes(key)) {
      issues.push('Expected a valid absolute URL.');
    }
  }

  return issues;
};

export const buildRuntimeEnvCatalog = (
  adminRows: Array<{
    domain: string;
    isActive: boolean;
    key: string;
    value: string;
  }>,
): RuntimeEnvCatalogRow[] => {
  const adminByDomainKey = new Map(
    adminRows
      .filter((row) => row.isActive)
      .map((row) => [`${row.domain}:${row.key}`, row.value] as const),
  );
  const adminByKey = new Map(
    adminRows.filter((row) => row.isActive).map((row) => [row.key, row.value]),
  );

  return [...runtimeEnvCatalog, ...getExistingProcessEnvItems()].map((item) => {
    const adminValue =
      adminByDomainKey.get(`${item.domain}:${item.key}`) || adminByKey.get(item.key);
    const processValue = getProcessValue(item.key);
    const effectiveValue = adminValue || processValue;

    return {
      ...item,
      adminValueMasked: maskValue(adminValue),
      hasAdminValue: !!adminValue,
      hasProcessValue: !!processValue,
      issues: effectiveValue ? getHostIssues(item.key, effectiveValue) : ['Missing value.'],
      processValueMasked: maskValue(processValue),
      source: adminValue ? 'admin' : processValue ? 'process' : 'missing',
    };
  });
};

export const getRuntimeEnvImportValues = (keys?: string[]) => {
  const allow = keys ? new Set(keys) : undefined;

  return [...runtimeEnvCatalog, ...getExistingProcessEnvItems()]
    .filter((item) => !allow || allow.has(item.key))
    .map((item) => ({ ...item, value: getProcessValue(item.key) }))
    .filter((item): item is RuntimeEnvCatalogItem & { value: string } => !!item.value);
};
