import isEqual from 'fast-deep-equal';
import { useMemo } from 'react';

import { getModelDisplayName } from '@/components/ModelSelect/modelDisplay';
import { useAiInfraStore } from '@/store/aiInfra';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

export const useEnabledChatModels = (): EnabledProviderWithModels[] => {
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList, isEqual);

  return useMemo(
    () =>
      (enabledChatModelList || []).map((provider) => ({
        ...provider,
        children: provider.children.map((model) => ({
          ...model,
          displayName: getModelDisplayName(model.id, model.displayName),
        })),
      })),
    [enabledChatModelList],
  );
};
