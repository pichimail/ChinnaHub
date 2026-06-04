import { isProviderDisableBrowserRequest } from 'model-bank/modelProviders';

import { type AIProviderStoreState } from '@/store/aiInfra/initialState';
import { type AiProviderRuntimeConfig } from '@/types/aiProvider';
import { AiProviderSourceEnum } from '@/types/aiProvider';
import { type GlobalLLMProviderKey } from '@/types/user/settings';

const imageAbilities = { files: true, imageOutput: true, reasoning: false, vision: true };
const videoAbilities = { files: true, imageOutput: false, reasoning: false, vision: true };

const chinnaImageProvider = {
  children: [
    { abilities: imageAbilities, displayName: 'chinnaimage-v1.0', id: 'grok-imagine/text-to-image' },
    { abilities: imageAbilities, displayName: 'chinnaimage-v1.0 image-to-image', id: 'grok-imagine/image-to-image' },
    { abilities: imageAbilities, displayName: 'chinnaimage-v1.0 upscale', id: 'grok-imagine/upscale' },
    { abilities: imageAbilities, displayName: 'chinnaauto/image', id: 'x-ai/grok-imagine-image-quality' },
  ],
  enabled: true,
  id: 'chinnaimage',
  name: 'Chinna Image',
  sort: 0,
} as any;

const chinnaVideoProvider = {
  children: [
    { abilities: videoAbilities, displayName: 'chinnavideo-v1.0', id: 'grok-imagine/text-to-video' },
    { abilities: videoAbilities, displayName: 'chinnavideo-v1.0 image-to-video', id: 'grok-imagine/image-to-video' },
    { abilities: videoAbilities, displayName: 'chinnavideo-v1.0 extend', id: 'grok-imagine/extend' },
    { abilities: videoAbilities, displayName: 'chinnavideo-v2.0', id: 'grok-imagine/1-5-preview' },
    { abilities: videoAbilities, displayName: 'chinnaauto/video', id: 'x-ai/grok-imagine-video' },
  ],
  enabled: true,
  id: 'chinnavideo',
  name: 'Chinna Video',
  sort: 0,
} as any;

const prependProvider = (list: any[] = [], provider: any) => {
  const filtered = list.filter((item) => item?.id !== provider.id);
  return [provider, ...filtered];
};

const enabledAiProviderList = (s: AIProviderStoreState) =>
  s.aiProviderList.filter((item) => item.enabled).sort((a, b) => a.sort! - b.sort!);

const disabledAiProviderList = (s: AIProviderStoreState) =>
  s.aiProviderList.filter((item) => !item.enabled && item.source !== AiProviderSourceEnum.Custom);

const disabledCustomAiProviderList = (s: AIProviderStoreState) =>
  s.aiProviderList.filter((item) => !item.enabled && item.source === AiProviderSourceEnum.Custom);

const enabledImageModelList = (s: AIProviderStoreState) =>
  prependProvider(s.enabledImageModelList || [], chinnaImageProvider);

const enabledVideoModelList = (s: AIProviderStoreState) =>
  prependProvider(s.enabledVideoModelList || [], chinnaVideoProvider);

const isProviderEnabled = (id: string) => (s: AIProviderStoreState) =>
  enabledAiProviderList(s).some((i) => i.id === id) || id === 'chinnaimage' || id === 'chinnavideo';

const isProviderLoading = (id: string) => (s: AIProviderStoreState) =>
  s.aiProviderLoadingIds.includes(id);

const providerDetailById = (id: string) => (s: AIProviderStoreState) => s.aiProviderDetailMap[id];

const activeProviderConfig = (s: AIProviderStoreState) =>
  s.activeAiProvider ? s.aiProviderDetailMap[s.activeAiProvider] : undefined;

const isAiProviderConfigLoading = (id: string) => (s: AIProviderStoreState) =>
  !s.aiProviderDetailMap[id];

const providerWhitelist = new Set(['ollama', 'lmstudio']);

const activeProviderKeyVaults = (s: AIProviderStoreState) => activeProviderConfig(s)?.keyVaults;

const isActiveProviderEndpointNotEmpty = (s: AIProviderStoreState) => {
  const vault = activeProviderKeyVaults(s);
  return !!vault?.baseURL || !!vault?.endpoint;
};

const isActiveProviderApiKeyNotEmpty = (s: AIProviderStoreState) => {
  const vault = activeProviderKeyVaults(s);
  return !!vault?.apiKey || !!vault?.accessKeyId || !!vault?.secretAccessKey;
};

const providerConfigById =
  (id: string) =>
  (s: AIProviderStoreState): AiProviderRuntimeConfig | undefined => {
    if (!id) return undefined;
    return s.aiProviderRuntimeConfig?.[id];
  };

const isProviderConfigUpdating = (id: string) => (s: AIProviderStoreState) =>
  s.aiProviderConfigUpdatingIds.includes(id);

const isProviderFetchOnClient =
  (provider: GlobalLLMProviderKey | string) => (s: AIProviderStoreState) => {
    const config = providerConfigById(provider)(s);
    if (isProviderDisableBrowserRequest(provider)) return false;
    if (providerWhitelist.has(provider) && typeof config?.fetchOnClient !== 'undefined')
      return config?.fetchOnClient;
    const isProviderEndpointNotEmpty = !!config?.keyVaults.baseURL;
    const isProviderApiKeyNotEmpty = !!config?.keyVaults.apiKey;
    if (!isProviderEndpointNotEmpty && !isProviderApiKeyNotEmpty) return false;
    if (isProviderEndpointNotEmpty && !isProviderApiKeyNotEmpty) return true;
    if (typeof config?.fetchOnClient !== 'undefined') return config?.fetchOnClient;
    return false;
  };

const providerKeyVaults = (provider: string | undefined) => (s: AIProviderStoreState) => {
  if (!provider) return undefined;
  return s.aiProviderRuntimeConfig?.[provider]?.keyVaults;
};

const isProviderHasBuiltinSearch = (provider: string) => (s: AIProviderStoreState) => {
  const config = providerConfigById(provider)(s);
  return !!config?.settings.searchMode;
};

const isProviderHasBuiltinSearchConfig = (id: string) => (s: AIProviderStoreState) => {
  const providerCfg = providerConfigById(id)(s);
  return !!providerCfg?.settings.searchMode && providerCfg?.settings.searchMode !== 'internal';
};

const isProviderEnableResponseApi = (id: string) => (s: AIProviderStoreState) => {
  const providerCfg = providerConfigById(id)(s);
  const enableResponseApi = providerCfg?.config?.enableResponseApi;
  if (typeof enableResponseApi === 'boolean') return enableResponseApi;
  return id === 'openai';
};

const isInitAiProviderRuntimeState = (s: AIProviderStoreState) => !!s.isInitAiProviderRuntimeState;

export const aiProviderSelectors = {
  activeProviderConfig,
  disabledAiProviderList,
  disabledCustomAiProviderList,
  enabledAiProviderList,
  enabledImageModelList,
  enabledVideoModelList,
  isActiveProviderApiKeyNotEmpty,
  isActiveProviderEndpointNotEmpty,
  isAiProviderConfigLoading,
  isInitAiProviderRuntimeState,
  isProviderConfigUpdating,
  isProviderEnableResponseApi,
  isProviderEnabled,
  isProviderFetchOnClient,
  isProviderHasBuiltinSearch,
  isProviderHasBuiltinSearchConfig,
  isProviderLoading,
  providerConfigById,
  providerDetailById,
  providerKeyVaults,
};
