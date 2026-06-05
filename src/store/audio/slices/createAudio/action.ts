import { lambdaClient } from '@/libs/trpc/client';
import { setNamespace } from '@/utils/storeDebug';

import { type AudioStore } from '../../store';
import { type AudioTrack } from './initialState';

const n = setNamespace('createAudio');

const POLL_MIN_MS = 2000;
const POLL_MAX_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

const randomPollInterval = () =>
  POLL_MIN_MS + Math.random() * (POLL_MAX_MS - POLL_MIN_MS);

const pollingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface CreateAudioAction {
  generateAudio: () => Promise<void>;
  stopPolling: (taskId: string) => void;
  updateAudioTrack: (taskId: string, patch: Partial<AudioTrack>) => void;
  clearFinishedTracks: () => void;
  setIsGenerating: (generating: boolean) => void;
  setGenerationError: (error: string | null) => void;
}

type Setter = (
  patch: Partial<AudioStore> | ((s: AudioStore) => Partial<AudioStore>),
  replace?: boolean,
  name?: string,
) => void;

export const createCreateAudioSlice = (set: Setter, get: () => AudioStore) =>
  ({
    setIsGenerating: (generating) => {
      set({ isGenerating: generating }, false, n('setIsGenerating'));
    },

    setGenerationError: (error) => {
      set({ generationError: error }, false, n('setGenerationError'));
    },

    updateAudioTrack: (taskId, patch) => {
      set(
        (s) => ({
          audioTracks: { ...s.audioTracks, [taskId]: { ...s.audioTracks[taskId], ...patch } },
        }),
        false,
        n('updateAudioTrack'),
      );
    },

    stopPolling: (taskId) => {
      const timer = pollingTimers.get(taskId);
      if (timer) {
        clearTimeout(timer);
        pollingTimers.delete(taskId);
      }
    },

    clearFinishedTracks: () => {
      set(
        (s) => ({
          audioTracks: Object.fromEntries(
            Object.entries(s.audioTracks).filter(
              ([, t]) => t.status !== 'completed' && t.status !== 'failed',
            ),
          ),
        }),
        false,
        n('clearFinishedTracks'),
      );
    },

    generateAudio: async () => {
      const state = get();
      const { prompt, lyrics, customMode, songTitle, stylePrompt, makeInstrumental, model, provider } = state;
      const generationPrompt = customMode ? lyrics : prompt;
      if (!generationPrompt?.trim()) return;

      set({ isGenerating: true, generationError: null }, false, n('start'));

      try {
        const result = await lambdaClient.audio.generateAudio.mutate({
          prompt: generationPrompt.trim(),
          customMode,
          style: stylePrompt?.trim() || undefined,
          title: songTitle?.trim() || undefined,
          makeInstrumental,
          model,
          provider,
        });

        const track: AudioTrack = {
          audioId: result.audioId,
          taskId: result.taskId,
          prompt: generationPrompt.trim(),
          status: 'pending',
          progress: 0,
          canPlayEarly: false,
          createdAt: result.createdAt ? new Date(result.createdAt) : new Date(),
        };

        set(
          (s) => ({
            isGenerating: false,
            audioTracks: { ...s.audioTracks, [result.taskId]: track },
          }),
          false,
          n('created'),
        );

        _startPolling(result.taskId, 0, get, set);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to generate audio';
        set({ isGenerating: false, generationError: msg }, false, n('error'));
      }
    },
  }) as CreateAudioAction;

function _startPolling(taskId: string, attempt: number, get: () => AudioStore, set: Setter) {
  if (attempt >= MAX_POLL_ATTEMPTS) {
    set(
      (s) => ({
        audioTracks: {
          ...s.audioTracks,
          [taskId]: { ...s.audioTracks[taskId], status: 'failed' },
        },
      }),
      false,
      'poll/timeout',
    );
    return;
  }

  const timer = setTimeout(async () => {
    pollingTimers.delete(taskId);
    const current = get().audioTracks[taskId];
    if (!current || current.status === 'completed' || current.status === 'failed') return;

    try {
      const status = await lambdaClient.audio.getAudioStatus.query({ taskId });

      set(
        (s) => ({
          audioTracks: {
            ...s.audioTracks,
            [taskId]: {
              ...s.audioTracks[taskId],
              status: status.status as AudioTrack['status'],
              audioUrl: status.audioUrl ?? s.audioTracks[taskId]?.audioUrl,
              imageUrl:
                (status.metadata as any)?.imageUrl ??
                (status.metadata as any)?.imageLargeUrl ??
                s.audioTracks[taskId]?.imageUrl,
              title:
                (status.metadata as any)?.title ?? s.audioTracks[taskId]?.title,
              duration:
                (status.metadata as any)?.duration ?? s.audioTracks[taskId]?.duration,
              progress: status.progress,
              canPlayEarly: false,
              clips: (status as any).clips ?? [],
            },
          },
        }),
        false,
        'poll/update',
      );

      if (status.status !== 'completed' && status.status !== 'failed') {
        _startPolling(taskId, attempt + 1, get, set);
      }
    } catch {
      _startPolling(taskId, attempt + 1, get, set);
    }
  }, randomPollInterval());

  pollingTimers.set(taskId, timer);
}

export type { CreateAudioAction };
