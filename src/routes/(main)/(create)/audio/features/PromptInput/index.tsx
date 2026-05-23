import { Button, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';

import { audioGenerationConfigSelectors, useAudioStore } from '@/store/audio';

export const PromptInput = () => {
  const { t } = useTranslation();
  const parameters = useAudioStore(audioGenerationConfigSelectors.parameters);
  const { setAudioPrompt, setAudioStyle, setAudioTitle, setMakeInstrumental, createAudio } =
    useAudioStore();

  const handleCreateAudio = async () => {
    await createAudio();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
          {t('generation.prompt', { ns: 'audio' })}
        </label>
        <Input.TextArea
          placeholder={t('generation.promptPlaceholder', { ns: 'audio' })}
          rows={4}
          value={parameters.prompt || ''}
          onChange={(e) => setAudioPrompt(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            {t('generation.style', { ns: 'audio' })}
          </label>
          <Select
            allowClear
            placeholder={t('generation.selectStyle', { ns: 'audio' })}
            style={{ width: '100%' }}
            value={parameters.style || undefined}
            options={[
              { label: 'Pop', value: 'pop' },
              { label: 'Rock', value: 'rock' },
              { label: 'Jazz', value: 'jazz' },
              { label: 'Classical', value: 'classical' },
              { label: 'Electronic', value: 'electronic' },
              { label: 'Hip Hop', value: 'hiphop' },
              { label: 'R&B', value: 'rnb' },
              { label: 'Country', value: 'country' },
              { label: 'Folk', value: 'folk' },
              { label: 'Ambient', value: 'ambient' },
            ]}
            onChange={(value) => setAudioStyle(value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            {t('generation.title', { ns: 'audio' })}
          </label>
          <Input
            placeholder={t('generation.titlePlaceholder', { ns: 'audio' })}
            value={parameters.title || ''}
            onChange={(e) => setAudioTitle(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input
          checked={parameters.makeInstrumental || false}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          type="checkbox"
          onChange={(e) => setMakeInstrumental(e.target.checked)}
        />
        <label style={{ cursor: 'pointer', margin: 0 }}>
          {t('generation.instrumental', { ns: 'audio' })}
        </label>
      </div>

      <Button
        block
        disabled={!parameters.prompt}
        loading={false}
        size="large"
        type="primary"
        onClick={handleCreateAudio}
      >
        {t('generation.generate', { ns: 'audio' })}
      </Button>
    </div>
  );
};
