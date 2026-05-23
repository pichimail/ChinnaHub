import { useCallback } from 'react';

import { useAudioStore } from '../../store';
import { audioGenerationConfigSelectors } from './selectors';

type ParamName = 'customMode' | 'instrumental' | 'negativeTags' | 'prompt' | 'style' | 'title';

export function useAudioGenerationConfigParam<N extends ParamName>(paramName: N) {
  const parameters = useAudioStore(audioGenerationConfigSelectors.parameters);
  const paramValue = parameters?.[paramName] as string | boolean;
  const setParamsValue = useAudioStore((s) => s.setParamOnInput);

  const setValue = useCallback(
    (value: string | boolean) => {
      setParamsValue(paramName, value);
    },
    [paramName, setParamsValue],
  );

  return {
    setValue,
    value: paramValue,
  };
}
