import { randomUUID } from 'node:crypto';

import type { AudioGenerationAsset, GenerationConfig } from '@lobechat/types';
import { FileSource } from '@lobechat/types';

import type { FileService } from '@/server/services/file';

export type AudioModelVersion = 'V1.0' | 'V2.0' | 'V3.0';

export interface KieAudioLyrics {
  alignedWords?: {
    endS?: number;
    palign?: number;
    startS?: number;
    success?: boolean;
    word: string;
  }[];
  isStreamed?: boolean;
  raw?: Record<string, unknown>;
  waveformData?: number[];
}

export interface KieAudioTrack {
  artist?: string;
  audioId?: string;
  audioUrl?: string;
  clipIndex?: number;
  coverUrl?: string;
  duration?: number;
  lyrics?: KieAudioLyrics;
  lyricsTaskId?: string;
  metadata?: Record<string, unknown>;
  modelName?: string;
  parentTaskId?: string;
  streamAudioUrl?: string;
  taskId?: string;
  title?: string;
  videoTaskId?: string;
  vocalsTaskId?: string;
}

export const KIE_MODEL_VERSION_MAP: Record<AudioModelVersion, string> = {
  'V1.0': 'V4_5ALL',
  'V2.0': 'V5',
  'V3.0': 'V5_5',
};

export const mapAudioModelVersionToKieModel = (modelVersion?: AudioModelVersion): string => {
  return KIE_MODEL_VERSION_MAP[modelVersion ?? 'V3.0'];
};

export const selectKieTrackUrl = (track?: Record<string, unknown>): string | undefined => {
  if (!track) return undefined;

  const values = [
    track.audioUrl,
    track.audio_url,
    track.streamAudioUrl,
    track.stream_audio_url,
    track.url,
  ];

  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
};

export const selectKieTrackCoverUrl = (track?: Record<string, unknown>): string | undefined => {
  if (!track) return undefined;

  const values = [track.coverUrl, track.cover_url, track.imageUrl, track.image_url];

  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
};

export const normalizeKieTrack = (
  track: Record<string, any>,
  taskId: string,
  index: number,
  fallbackArtist?: string,
): KieAudioTrack => {
  const audioUrl = selectKieTrackUrl(track);
  const coverUrl = selectKieTrackCoverUrl(track);
  const title = track.title || track.name || `Track ${index + 1}`;
  const artist = track.artist || fallbackArtist;

  return {
    artist,
    audioId: track.audioId || track.audio_id || track.id || undefined,
    audioUrl,
    clipIndex: track.clipIndex ?? index,
    coverUrl,
    duration: track.duration,
    lyrics: track.lyrics
      ? {
          alignedWords: Array.isArray(track.lyrics.alignedWords)
            ? track.lyrics.alignedWords
            : undefined,
          isStreamed: track.lyrics.isStreamed,
          raw: track.lyrics.raw || track.lyrics,
          waveformData: Array.isArray(track.lyrics.waveformData)
            ? track.lyrics.waveformData
            : undefined,
        }
      : undefined,
    lyricsTaskId: track.lyricsTaskId,
    metadata: {
      ...track,
      index,
      taskId,
    },
    modelName: track.modelName || track.model,
    parentTaskId: track.parentTaskId || taskId,
    streamAudioUrl: track.streamAudioUrl || track.stream_audio_url,
    taskId,
    title,
    videoTaskId: track.videoTaskId,
    vocalsTaskId: track.vocalsTaskId,
  };
};

export const normalizeKieTracks = (
  sunoData: unknown,
  taskId: string,
  fallbackArtist?: string,
): KieAudioTrack[] => {
  if (!Array.isArray(sunoData)) return [];

  return sunoData.map((track, index) =>
    normalizeKieTrack(track as Record<string, any>, taskId, index, fallbackArtist),
  );
};

export const buildAudioAssetFromTrack = (
  track: KieAudioTrack,
  metadata: {
    artist?: string;
    model: string;
    modelVersion?: AudioModelVersion;
    provider: string;
    taskId: string;
  },
  file: { fileId: string; key: string },
  coverKey?: string,
): AudioGenerationAsset => {
  return {
    artist: track.artist || metadata.artist,
    audioId: track.audioId,
    clipIndex: track.clipIndex,
    coverUrl: coverKey || track.coverUrl,
    coverTaskId: track.metadata?.coverTaskId as string | undefined,
    duration: track.duration,
    fileId: file.fileId,
    lyrics: track.lyrics,
    lyricsTaskId: track.lyricsTaskId,
    modelVersion: metadata.modelVersion,
    parentTaskId: track.parentTaskId || metadata.taskId,
    originalUrl: track.audioUrl || track.streamAudioUrl,
    title: track.title,
    type: 'audio',
    url: file.key,
    videoTaskId: track.videoTaskId,
    vocalsTaskId: track.vocalsTaskId,
    metadata: {
      ...track.metadata,
      model: metadata.model,
      modelVersion: metadata.modelVersion,
    },
  };
};

export const getAudioFilePath = (userId: string, extension: string): string => {
  const safeExtension = extension.length > 8 ? 'mp3' : extension;
  return `generations/audio/${userId}/${randomUUID()}.${safeExtension}`;
};

export const getCoverFilePath = (userId: string, extension: string): string => {
  const safeExtension = extension.length > 8 ? 'webp' : extension;
  return `generations/audio/${userId}/${randomUUID()}.${safeExtension}`;
};

export const persistKieTrack = async ({
  fileService,
  generationId,
  generationModel,
  metadata,
  track,
  userId,
}: {
  fileService: FileService;
  generationId: string;
  generationModel: {
    update: (id: string, value: Partial<any>) => Promise<unknown>;
  };
  metadata: {
    artist?: string;
    generationIds?: string[];
    model: string;
    modelVersion?: AudioModelVersion;
    parameters: GenerationConfig & { artist?: string; modelVersion?: AudioModelVersion };
    provider: string;
    providerMode: 'classic' | 'lyria';
    taskId: string;
    webhookToken?: string;
  };
  track: KieAudioTrack;
  userId: string;
}) => {
  if (!track.audioUrl) return metadata;

  const audioExtension = track.audioUrl.split('?')[0].split('.').pop() || 'mp3';
  const audioPath = getAudioFilePath(userId, audioExtension);
  const audioFile = await fileService.uploadFromUrl(
    track.audioUrl,
    audioPath,
    FileSource.AudioGeneration,
  );

  let coverKey: string | undefined;
  if (track.coverUrl) {
    const coverExtension = track.coverUrl.split('?')[0].split('.').pop() || 'webp';
    const coverPath = getCoverFilePath(userId, coverExtension);
    const coverFile = await fileService.uploadFromUrl(
      track.coverUrl,
      coverPath,
      FileSource.AudioGeneration,
    );
    coverKey = coverFile.key;
  }

  await generationModel.update(generationId, {
    asset: buildAudioAssetFromTrack(
      track,
      metadata,
      { fileId: audioFile.fileId, key: audioFile.key },
      coverKey,
    ),
    fileId: audioFile.fileId,
  });

  return {
    ...metadata,
    audioUrl: audioFile.key,
    coverUrl: coverKey,
    duration: track.duration,
    fileId: audioFile.fileId,
    originalUrl: track.audioUrl,
  };
};

export const collectAudioAssetUrls = (asset?: AudioGenerationAsset | null): string[] => {
  if (!asset) return [];

  return [asset.url, asset.originalUrl, asset.coverUrl].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
};
