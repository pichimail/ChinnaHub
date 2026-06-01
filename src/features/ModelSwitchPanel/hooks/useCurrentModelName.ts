import { useMemo } from 'react';

import { getModelDisplayName } from '@/components/ModelSelect/modelDisplay';
import { type EnabledProviderWithModels } from '@/types/aiProvider';

export const useCurrentModelName = (
  enabledList: EnabledProviderWithModels[],
  model: string,
): string => {
  return useMemo(() => {
    for (const providerItem of enabledList) {
      const modelItem = providerItem.children.find((m) => m.id === model);
      if (modelItem) {
        return getModelDisplayName(modelItem.id, modelItem.displayName);
      }
    }
    return getModelDisplayName(model, model);
  }, [enabledList, model]);
};
