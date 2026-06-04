'use client';

import { AsyncTaskStatus } from '@lobechat/types';
import { memo, useEffect, useMemo, useRef } from 'react';

import {
  audioGenerationBatchSelectors,
  audioGenerationTopicSelectors,
  useAudioStore,
} from '@/store/audio';
import { type AudioGenerationAsset } from '@/types/generation';

export const AudioConversationReadyWatcher = memo(() => {
  const activeTopicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore((state) =>
    audioGenerationBatchSelectors.batches(activeTopicId || '')(state),
  );
  const appendAudioMessage = useAudioStore((state) => state.appendAudioMessage);
  const setLastAudioTrackContext = useAudioStore((state) => state.setLastAudioTrackContext);
  const announcedRef = useRef<Set<string>>(new Set());

  const readySnapshots = useMemo(() => {
    return batches
      .map((batch) => {
        const playable = batch.generations.filter((generation) => {
          const asset = generation.asset as AudioGenerationAsset | undefined;
          return Boolean(asset?.url || asset?.originalUrl);
        });

        if (playable.length === 0) return null;

        const firstGeneration = playable[0];
        const asset = firstGeneration.asset as AudioGenerationAsset | undefined;
        const isComplete =
          playable.length >= 2 ||
          batch.generations.every((generation) => generation.task.status !== AsyncTaskStatus.Processing);

        return {
          batchId: batch.id,
          count: playable.length,
          isComplete,
          prompt: batch.prompt,
          track: {
            artist: asset?.artist,
            batchId: batch.id,
            generationId: firstGeneration.id,
            prompt: batch.prompt,
            title: asset?.title || batch.prompt || 'Generated track',
            url: asset?.url || asset?.originalUrl,
          },
        };
      })
      .filter(Boolean);
  }, [batches]);

  useEffect(() => {
    if (!activeTopicId) return;

    for (const snapshot of readySnapshots) {
      if (!snapshot) continue;
      const key = `${activeTopicId}:${snapshot.batchId}:${snapshot.count}:${snapshot.isComplete}`;
      if (announcedRef.current.has(key)) continue;
      announcedRef.current.add(key);

      setLastAudioTrackContext(snapshot.track);
      appendAudioMessage({
        content: snapshot.isComplete
          ? 'Your two tracks are ready. What changes do you want? Ask me to extend, remix, add vocals, remove vocals, split stems, replace a section, boost the style, or create cover/video assets.'
          : 'The first track is ready. I am still checking for the second option. What direction should the next version take?',
        intent: 'ready',
        role: 'assistant',
        topicId: activeTopicId,
        trackContext: snapshot.track,
      });
    }
  }, [activeTopicId, appendAudioMessage, readySnapshots, setLastAudioTrackContext]);

  return null;
});

AudioConversationReadyWatcher.displayName = 'AudioConversationReadyWatcher';

export default AudioConversationReadyWatcher;
