import { randomUUID, timingSafeEqual } from 'node:crypto';

import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus, FileSource } from '@lobechat/types';
import debug from 'debug';
import { NextResponse } from 'next/server';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { getServerDB } from '@/database/server';
import { FileService } from '@/server/services/file';

const log = debug('lobe-audio:webhook');

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
};

const getFirstTrackFromCallback = (body: any) => {
  const data = body?.data?.data;
  if (!Array.isArray(data)) return undefined;

  return data.find(
    (item) =>
      item?.audioUrl ||
      item?.audio_url ||
      item?.streamAudioUrl ||
      item?.stream_audio_url ||
      item?.url,
  );
};

export const POST = async (req: Request) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const taskId = body?.data?.task_id || body?.data?.taskId || body?.task_id || body?.taskId;

  if (!taskId || typeof taskId !== 'string') {
    return NextResponse.json({ error: 'Missing task_id in callback payload' }, { status: 400 });
  }

  log('Received KIE audio callback for taskId=%s, code=%s', taskId, String(body?.code));

  try {
    const db = await getServerDB();
    const asyncTask = await AsyncTaskModel.findLatestByMetadataTaskId(db, taskId);

    if (!asyncTask) {
      return NextResponse.json(
        { error: `AsyncTask not found for taskId=${taskId}` },
        { status: 404 },
      );
    }

    const metadata = (asyncTask.metadata || {}) as Record<string, any>;
    const expectedToken = typeof metadata.webhookToken === 'string' ? metadata.webhookToken : '';
    const token = new URL(req.url).searchParams.get('token') || '';

    if (expectedToken && (!token || !safeCompare(token, expectedToken))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (
      asyncTask.status === AsyncTaskStatus.Success ||
      asyncTask.status === AsyncTaskStatus.Error
    ) {
      return NextResponse.json({ success: true });
    }

    const asyncTaskModel = new AsyncTaskModel(db, asyncTask.userId);
    const generationModel = new GenerationModel(db, asyncTask.userId);
    const generation = await generationModel.findByAsyncTaskId(asyncTask.id);

    if (!generation) {
      return NextResponse.json(
        { error: `Generation not found for asyncTaskId=${asyncTask.id}` },
        { status: 404 },
      );
    }

    const firstTrack = getFirstTrackFromCallback(body);
    const audioUrl =
      firstTrack?.audioUrl ||
      firstTrack?.audio_url ||
      firstTrack?.streamAudioUrl ||
      firstTrack?.stream_audio_url ||
      firstTrack?.url ||
      '';

    if (body?.code === 200 && audioUrl) {
      const fileService = new FileService(db, asyncTask.userId);
      const extension = audioUrl.split('?')[0].split('.').pop() || 'mp3';
      const safeExtension = extension.length > 8 ? 'mp3' : extension;
      const pathname = `generations/audio/${asyncTask.userId}/${randomUUID()}.${safeExtension}`;
      const file = await fileService.uploadFromUrl(audioUrl, pathname, FileSource.AudioGeneration);

      await generationModel.update(generation.id, {
        asset: {
          duration: firstTrack?.duration,
          fileId: file.fileId,
          originalUrl: audioUrl,
          type: 'audio',
          url: file.key,
        },
        fileId: file.fileId,
      });

      await asyncTaskModel.update(asyncTask.id, {
        metadata: {
          ...metadata,
          audioUrl: file.key,
          duration: firstTrack?.duration,
          fileId: file.fileId,
          originalUrl: audioUrl,
          rawCallback: body,
        },
        status: AsyncTaskStatus.Success,
      });

      return NextResponse.json({ success: true });
    }

    await asyncTaskModel.update(asyncTask.id, {
      error: new AsyncTaskError(
        AsyncTaskErrorType.ServerError,
        body?.msg || body?.data?.errorMessage || 'Music generation failed',
      ),
      metadata: {
        ...metadata,
        rawCallback: body,
      },
      status: AsyncTaskStatus.Error,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[audio-webhook] Processing failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
