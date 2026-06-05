'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { Input, Switch } from 'antd';
import { createStaticStyles } from 'antd-style';
import { InfoIcon, MicOffIcon, Music2Icon } from 'lucide-react';
import { memo, useMemo } from 'react';

import { useAudioStore } from '@/store/audio';
import { audioGenerationConfigSelectors } from '@/store/audio/slices/generationConfig/selectors';

const useStyles = createStaticStyles(({ css, token }) => ({
  albumArt: css`
    overflow: hidden;
    aspect-ratio: 1;
    width: 100%;
    border-radius: 12px;
    background: ${token.colorFillSecondary};
    border: 1px solid ${token.colorBorderSecondary};
  `,
  albumImage: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  `,
  albumFallback: css`
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${token.colorTextQuaternary};
    font-size: 38px;
  `,
  section: css`
    padding: 16px;
    border-radius: 12px;
    background: ${token.colorFillTertiary};
    margin-bottom: 12px;
  `,
  label: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  `,
  hint: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
    margin-top: 4px;
    line-height: 1.5;
  `,
}));

const ConfigPanel = memo(() => {
  const { styles } = useStyles();

  const customMode = useAudioStore(audioGenerationConfigSelectors.customMode);
  const lyrics = useAudioStore(audioGenerationConfigSelectors.lyrics);
  const stylePrompt = useAudioStore(audioGenerationConfigSelectors.stylePrompt);
  const makeInstrumental = useAudioStore(audioGenerationConfigSelectors.makeInstrumental);
  const audioTracks = useAudioStore((s) => s.audioTracks);

  const setCustomMode = useAudioStore((s) => s.setCustomMode);
  const setLyrics = useAudioStore((s) => s.setLyrics);
  const setStylePrompt = useAudioStore((s) => s.setStylePrompt);
  const setMakeInstrumental = useAudioStore((s) => s.setMakeInstrumental);

  const latestReadyTrack = useMemo(
    () =>
      Object.values(audioTracks)
        .filter((track) => track.status === 'completed' && track.imageUrl)
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0],
    [audioTracks],
  );

  return (
    <Flexbox gap={0} padding={16} style={{ overflowY: 'auto', height: '100%' }}>
      <div className={styles.section}>
        <div className={styles.label}>Album art</div>
        <div className={styles.albumArt}>
          {latestReadyTrack?.imageUrl ? (
            <img
              alt={latestReadyTrack.title || 'Accoustica album art'}
              className={styles.albumImage}
              src={latestReadyTrack.imageUrl}
            />
          ) : (
            <div className={styles.albumFallback}>♪</div>
          )}
        </div>
        <div className={styles.hint}>
          Generated song artwork appears here after Accoustica finishes the track.
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Generation Mode</div>
        <Flexbox align="center" horizontal justify="space-between">
          <Flexbox gap={6} horizontal align="center">
            <Music2Icon size={14} />
            <Text weight={500}>{customMode ? 'Advanced lyrics' : 'Simple prompt'}</Text>
          </Flexbox>
          <Switch checked={customMode} onChange={setCustomMode} size="small" />
        </Flexbox>
        <div className={styles.hint}>
          {customMode
            ? 'Use the lyrics field for full song writing control.'
            : 'Describe the song and Accoustica will write the structure.'}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Lyrics</div>
        <Input.TextArea
          autoSize={{ maxRows: 8, minRows: 4 }}
          maxLength={5000}
          placeholder="Add lyrics for advanced Accoustica generation"
          showCount
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Music style</div>
        <Input.TextArea
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={1000}
          placeholder="Pop, lo-fi, cinematic, Telugu folk, soulful, energetic..."
          showCount
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Vocals</div>
        <Flexbox align="center" horizontal justify="space-between">
          <Flexbox gap={6} horizontal align="center">
            <MicOffIcon size={14} />
            <Text weight={500}>Instrumental</Text>
          </Flexbox>
          <Switch checked={makeInstrumental} onChange={setMakeInstrumental} size="small" />
        </Flexbox>
        <div className={styles.hint}>
          {makeInstrumental ? 'No vocals, music only.' : 'Accoustica can add vocals when suitable.'}
        </div>
      </div>

      <div className={styles.section}>
        <Flexbox gap={6} horizontal align="flex-start">
          <InfoIcon size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <div className={styles.hint}>
            Controls stay hidden until generation is complete. Hover the album art after it is ready
            to play, download, share, or open more actions.
          </div>
        </Flexbox>
      </div>
    </Flexbox>
  );
});

ConfigPanel.displayName = 'AudioConfigPanel';

export default ConfigPanel;
