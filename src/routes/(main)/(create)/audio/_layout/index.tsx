import { Flexbox } from '@lobehub/ui';

import { audioGenerationConfigSelectors, useAudioStore } from '@/store/audio';

import { AudioWorkspace } from '../features/AudioWorkspace';
import { GenerationFeed } from '../features/GenerationFeed';
import { PromptInput } from '../features/PromptInput';

const AudioLayout = () => {
  const isInit = useAudioStore(audioGenerationConfigSelectors.isInit);

  if (!isInit) {
    return <div style={{ padding: '24px' }}>Loading audio configuration...</div>;
  }

  return (
    <Flexbox horizontal distribution="space-between" gap={16} height="100%" width="100%">
      <Flexbox
        flex={1}
        flexDirection="column"
        gap={16}
        style={{
          minWidth: 0,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        <PromptInput />
        <GenerationFeed />
      </Flexbox>

      <Flexbox
        flex={1}
        flexDirection="column"
        gap={16}
        style={{
          borderLeft: '1px solid var(--colorBorder)',
          minWidth: 0,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        <AudioWorkspace />
      </Flexbox>
    </Flexbox>
  );
};

export default AudioLayout;
