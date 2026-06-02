import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KieAiAudioService } from './index';
import {
  buildAudioAssetFromTrack,
  mapAudioModelVersionToKieModel,
  normalizeKieTracks,
} from './kie';

describe('audio kie helpers', () => {
  it('maps visible model versions to Kie models', () => {
    expect(mapAudioModelVersionToKieModel('V1.0')).toBe('V4_5ALL');
    expect(mapAudioModelVersionToKieModel('V2.0')).toBe('V5');
    expect(mapAudioModelVersionToKieModel('V3.0')).toBe('V5_5');
  });

  it('normalizes every returned track instead of truncating the batch', () => {
    const tracks = normalizeKieTracks(
      [
        {
          audio_url: 'https://cdn.example.com/track-1.mp3',
          cover_url: 'https://cdn.example.com/cover-1.png',
          id: 'audio-1',
          title: 'Track 1',
        },
        {
          audio_url: 'https://cdn.example.com/track-2.mp3',
          cover_url: 'https://cdn.example.com/cover-2.png',
          id: 'audio-2',
          title: 'Track 2',
        },
      ],
      'task-1',
      'ChinnaHub',
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toMatchObject({
      artist: 'ChinnaHub',
      audioId: 'audio-1',
      audioUrl: 'https://cdn.example.com/track-1.mp3',
      coverUrl: 'https://cdn.example.com/cover-1.png',
      parentTaskId: 'task-1',
      title: 'Track 1',
    });
    expect(tracks[1]).toMatchObject({
      audioId: 'audio-2',
      audioUrl: 'https://cdn.example.com/track-2.mp3',
      title: 'Track 2',
    });
  });

  it('builds audio assets with provider metadata and track identifiers', () => {
    const asset = buildAudioAssetFromTrack(
      {
        artist: 'ChinnaHub',
        audioId: 'audio-1',
        audioUrl: 'https://cdn.example.com/track-1.mp3',
        clipIndex: 0,
        coverUrl: 'https://cdn.example.com/cover-1.png',
        duration: 183,
        lyrics: {
          alignedWords: [{ endS: 1, startS: 0, success: true, word: 'hello' }],
          isStreamed: true,
          raw: { foo: 'bar' },
          waveformData: [1, 2, 3],
        },
        parentTaskId: 'task-1',
        taskId: 'task-1',
        title: 'Track 1',
      },
      {
        artist: 'ChinnaHub',
        model: 'V4_5ALL',
        modelVersion: 'V1.0',
        provider: 'kie-ai',
        taskId: 'task-1',
      },
      { fileId: 'file-1', key: 'generations/audio/user/track-1.mp3' },
    );

    expect(asset).toMatchObject({
      artist: 'ChinnaHub',
      audioId: 'audio-1',
      clipIndex: 0,
      duration: 183,
      fileId: 'file-1',
      modelVersion: 'V1.0',
      parentTaskId: 'task-1',
      title: 'Track 1',
      type: 'audio',
      url: 'generations/audio/user/track-1.mp3',
    });
    expect(asset.metadata).toMatchObject({
      model: 'V4_5ALL',
      modelVersion: 'V1.0',
    });
  });
});

describe('KieAiAudioService#createMusic', () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('sends the required callback URL and omits false instrumental flags', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 200, data: { taskId: 'task-1' }, msg: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const service = new KieAiAudioService('test-api-key');
    await service.createMusic(
      {
        prompt: 'A warm Telugu folk song with a driving rhythm',
        providerMode: 'classic',
        modelVersion: 'V3.0',
      },
      { callBackUrl: 'https://app.itsmechinna.com/api/webhooks/audio/kie?token=test' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(init?.body as string) as Record<string, unknown>;

    expect(url).toBe('https://api.kie.ai/api/v1/generate');
    expect(init?.headers).toMatchObject({
      'Authorization': 'Bearer test-api-key',
      'Content-Type': 'application/json',
    });
    expect(payload).toMatchObject({
      callBackUrl: 'https://app.itsmechinna.com/api/webhooks/audio/kie?token=test',
      customMode: false,
      model: 'V5_5',
      prompt: 'A warm Telugu folk song with a driving rhythm',
    });
    expect(payload).not.toHaveProperty('instrumental');
    expect(payload).not.toHaveProperty('style');
    expect(payload).not.toHaveProperty('title');
  });

  it('promotes instrumental requests to custom mode with explicit fields', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 200, data: { taskId: 'task-2' }, msg: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const service = new KieAiAudioService('test-api-key');
    await service.createMusic(
      {
        makeInstrumental: true,
        prompt: 'cinematic ambient intro',
        providerMode: 'classic',
        title: 'Night Drive',
      },
      { callBackUrl: 'https://app.itsmechinna.com/api/webhooks/audio/kie?token=test' },
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const payload = JSON.parse(init?.body as string) as Record<string, unknown>;

    expect(payload).toMatchObject({
      customMode: true,
      instrumental: true,
      prompt: 'cinematic ambient intro',
      title: 'Night Drive',
    });
    expect(payload).toHaveProperty('style', 'Instrumental');
  });

  it('retries prompt-only generations with a compatibility payload when Kie rejects the first request', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('<html><body><h1>HTTP Status 400 – Bad Request</h1></body></html>', {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, data: { taskId: 'task-3' }, msg: 'success' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const service = new KieAiAudioService('test-api-key');
    const result = await service.createMusic(
      {
        prompt: 'A warm Telugu folk song with a driving rhythm',
        providerMode: 'classic',
        modelVersion: 'V3.0',
      },
      { callBackUrl: 'https://app.itsmechinna.com/api/webhooks/audio/kie?token=test' },
    );

    expect(result.id).toBe('task-3');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstPayload = JSON.parse(fetchMock.mock.calls[0]![1]?.body as string) as Record<
      string,
      unknown
    >;
    const secondPayload = JSON.parse(fetchMock.mock.calls[1]![1]?.body as string) as Record<
      string,
      unknown
    >;

    expect(firstPayload).toMatchObject({
      customMode: false,
      model: 'V5_5',
      prompt: 'A warm Telugu folk song with a driving rhythm',
    });
    expect(secondPayload).toMatchObject({
      customMode: false,
      instrumental: false,
      model: 'V5',
      prompt: 'A warm Telugu folk song with a driving rhythm',
    });
  });
});
