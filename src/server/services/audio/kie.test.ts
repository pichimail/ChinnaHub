import { describe, expect, it } from 'vitest';

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
