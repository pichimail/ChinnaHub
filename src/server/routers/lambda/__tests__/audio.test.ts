import { AsyncTaskStatus } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAsyncTaskCreate,
  mockAsyncTaskFindById,
  mockAsyncTaskUpdate,
  mockCreateMusic,
  mockFindByIdAndTransform,
  mockGenerationBatchCreate,
  mockGenerationCreate,
  mockPersistKieTrack,
  mockPollMusicStatus,
  mockServerDB,
} = vi.hoisted(() => {
  const mockServerDB = {};
  const mockCreateMusic = vi.fn();
  const mockPollMusicStatus = vi.fn();
  const mockAsyncTaskCreate = vi.fn();
  const mockAsyncTaskFindById = vi.fn();
  const mockAsyncTaskUpdate = vi.fn();
  const mockGenerationBatchCreate = vi.fn();
  const mockGenerationCreate = vi.fn();
  const mockFindByIdAndTransform = vi.fn();
  const mockPersistKieTrack = vi.fn();

  return {
    mockAsyncTaskCreate,
    mockAsyncTaskFindById,
    mockAsyncTaskUpdate,
    mockCreateMusic,
    mockFindByIdAndTransform,
    mockGenerationBatchCreate,
    mockGenerationCreate,
    mockPersistKieTrack,
    mockPollMusicStatus,
    mockServerDB,
  };
});

const generationAssets = new Map<string, any>();
let asyncTaskState: any = null;
let generationCounter = 0;

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn().mockResolvedValue(mockServerDB),
}));
vi.mock('@/database/server', () => ({
  getServerDB: vi.fn().mockResolvedValue(mockServerDB),
}));
vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn().mockImplementation(() => ({
    create: mockAsyncTaskCreate,
    findById: mockAsyncTaskFindById,
    update: mockAsyncTaskUpdate,
  })),
}));
vi.mock('@/database/models/generationBatch', () => ({
  GenerationBatchModel: vi.fn().mockImplementation(() => ({
    create: mockGenerationBatchCreate,
  })),
}));
vi.mock('@/database/models/generation', () => ({
  GenerationModel: vi.fn().mockImplementation(() => ({
    create: mockGenerationCreate,
    findByIdAndTransform: mockFindByIdAndTransform,
    findByIdWithAsyncTask: vi.fn(async (id: string) => {
      const asset = generationAssets.get(id) || null;
      return asset
        ? {
            asset,
            asyncTask: asyncTaskState
              ? {
                  error: asyncTaskState.error || null,
                  metadata: asyncTaskState.metadata,
                  status: asyncTaskState.status,
                }
              : null,
            asyncTaskId: asyncTaskState?.id || null,
            id,
          }
        : null;
    }),
    update: vi.fn(async (id: string, value: any) => {
      const current = generationAssets.get(id) || {};
      generationAssets.set(id, { ...current, ...value.asset });
    }),
  })),
}));
vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@/server/services/admin/runtimeGovernance', () => ({
  enforceContentTextPolicy: vi.fn().mockResolvedValue({ allowed: true }),
  enforceGovernancePolicy: vi.fn().mockResolvedValue({ allowed: true }),
  enforceProviderAvailability: vi.fn().mockResolvedValue({ allowed: true }),
  enforceUserFeatureAccess: vi.fn().mockResolvedValue({ allowed: true }),
  getManagedApiKey: vi.fn().mockResolvedValue('test-api-key'),
  getManagedEnvVar: vi.fn().mockResolvedValue(undefined),
  writeGovernanceEnforcementAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/server/services/audio', () => ({
  KieAiAudioService: vi.fn().mockImplementation(() => ({
    createMusic: mockCreateMusic,
    getTimestampedLyrics: vi.fn(),
    generateMusicCover: vi.fn(),
    pollMusicStatus: mockPollMusicStatus,
    separateVocals: vi.fn(),
    createMusicVideo: vi.fn(),
  })),
  OpenRouterLyriaAudioService: vi.fn().mockImplementation(() => ({
    createMusic: mockCreateMusic,
    pollMusicStatus: mockPollMusicStatus,
  })),
}));
vi.mock('@/server/services/audio/kie', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    persistKieTrack: mockPersistKieTrack,
  };
});
vi.mock('debug', () => ({ default: vi.fn(() => vi.fn()) }));

const makeGeneration = (id: string) => ({
  asset: generationAssets.get(id) || null,
  asyncTaskId: asyncTaskState?.id || null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  id,
  seed: null,
  task: {
    error: asyncTaskState?.error || undefined,
    id: asyncTaskState?.id || '',
    status: asyncTaskState?.status || AsyncTaskStatus.Processing,
  },
});

const { audioRouter } = await import('../audio');

describe('audioRouter', () => {
  const mockCtx = { userId: 'test-user' };

  const resetState = () => {
    generationAssets.clear();
    generationCounter = 0;
    asyncTaskState = null;

    mockAsyncTaskCreate.mockReset();
    mockAsyncTaskFindById.mockReset();
    mockAsyncTaskUpdate.mockReset();
    mockCreateMusic.mockReset();
    mockFindByIdAndTransform.mockReset();
    mockGenerationBatchCreate.mockReset();
    mockGenerationCreate.mockReset();
    mockPersistKieTrack.mockReset();
    mockPollMusicStatus.mockReset();
  };

  beforeEach(() => {
    resetState();

    mockAsyncTaskCreate.mockImplementation(async ({ metadata, status }: any) => {
      asyncTaskState = {
        error: null,
        id: 'async-1',
        metadata,
        status,
      };
      return 'async-1';
    });

    mockAsyncTaskFindById.mockImplementation(async (id: string) => {
      return asyncTaskState?.id === id ? asyncTaskState : null;
    });

    mockAsyncTaskUpdate.mockImplementation(async (_id: string, value: any) => {
      asyncTaskState = {
        ...asyncTaskState,
        ...value,
        metadata: value.metadata || asyncTaskState?.metadata,
      };
    });

    mockGenerationBatchCreate.mockImplementation(async (value: any) => ({
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      id: 'batch-1',
      ...value,
    }));

    mockGenerationCreate.mockImplementation(async (value: any) => {
      generationCounter += 1;
      const id = `gen-${generationCounter}`;
      generationAssets.set(id, null);
      return {
        id,
        ...value,
      };
    });

    mockFindByIdAndTransform.mockImplementation(async (id: string) => {
      return makeGeneration(id);
    });

    mockCreateMusic.mockResolvedValue({ id: 'task-1', status: 'processing' });

    mockPollMusicStatus.mockResolvedValue({
      id: 'task-1',
      status: 'processing',
      tracks: [
        {
          audioId: 'audio-1',
          audioUrl: 'https://cdn.example.com/track-1.mp3',
          clipIndex: 0,
          duration: 181,
          parentTaskId: 'task-1',
          taskId: 'task-1',
          title: 'Track 1',
        },
        {
          audioId: 'audio-2',
          audioUrl: 'https://cdn.example.com/track-2.mp3',
          clipIndex: 1,
          duration: 186,
          parentTaskId: 'task-1',
          taskId: 'task-1',
          title: 'Track 2',
        },
      ],
    });

    mockPersistKieTrack.mockImplementation(async ({ generationId, metadata, track }: any) => {
      const asset = {
        artist: track.artist || metadata.artist,
        audioId: track.audioId,
        clipIndex: track.clipIndex,
        duration: track.duration,
        modelVersion: metadata.modelVersion,
        originalUrl: track.audioUrl,
        parentTaskId: track.parentTaskId || metadata.taskId,
        title: track.title,
        type: 'audio',
        url: `stored-${generationId}.mp3`,
      };

      generationAssets.set(generationId, asset);

      return {
        ...metadata,
        audioUrl: asset.url,
        duration: track.duration,
        fileId: `file-${generationId}`,
        originalUrl: track.audioUrl,
      };
    });
  });

  it('creates two generations for the default Kie/Suno flow', async () => {
    const caller = audioRouter.createCaller(mockCtx);

    const result = await caller.createAudio({
      parameters: {
        prompt: 'uplifting synthwave',
        providerMode: 'classic',
        title: 'Night Drive',
      },
      topicId: 'topic-1',
    });

    expect(result.success).toBe(true);
    expect(result.data?.generations).toHaveLength(2);
    expect(result.data?.batch?.generations).toHaveLength(2);
    expect(mockGenerationCreate).toHaveBeenCalledTimes(2);
    expect(asyncTaskState.metadata.generationIds).toEqual(['gen-1', 'gen-2']);
  });

  it('keeps a FIRST_SUCCESS polling response live while persisting both tracks', async () => {
    asyncTaskState = {
      error: null,
      id: 'async-1',
      metadata: {
        followUpTaskIds: [],
        followUpTaskMap: {},
        generationIds: ['gen-1', 'gen-2'],
        model: 'V4_5ALL',
        modelVersion: 'V3.0',
        parameters: {
          prompt: 'uplifting synthwave',
          providerMode: 'classic',
        },
        provider: 'kie-ai',
        providerMode: 'classic',
        taskId: 'task-1',
      },
      status: AsyncTaskStatus.Processing,
    };

    generationAssets.set('gen-1', null);
    generationAssets.set('gen-2', null);

    const caller = audioRouter.createCaller(mockCtx);

    const result = await caller.getAudioStatus({
      asyncTaskId: 'async-1',
    });

    expect(result.status).toBe(AsyncTaskStatus.Processing);
    expect(result.generations).toHaveLength(2);
    expect(mockPersistKieTrack).toHaveBeenCalledTimes(2);
    expect(mockAsyncTaskUpdate).toHaveBeenCalled();
    expect(generationAssets.get('gen-1')).toMatchObject({ url: 'stored-gen-1.mp3' });
    expect(generationAssets.get('gen-2')).toMatchObject({ url: 'stored-gen-2.mp3' });
  });
});
