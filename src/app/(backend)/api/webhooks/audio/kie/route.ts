import { timingSafeEqual } from 'node:crypto';

import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus, FileSource } from '@lobechat/types';
import debug from 'debug';
import { NextResponse } from 'next/server';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { getServerDB } from '@/database/server';
import { normalizeKieTracks, persistKieTrack } from '@/server/services/audio/kie';
import { FileService } from '@/server/services/file';

const log = debug('lobe-audio:webhook');

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
};

const getFollowUpGenerationId = (
  metadata: Record<string, any>,
  taskId: string,
): string | undefined => {
  const followUpTaskMap = metadata.followUpTaskMap as Record<string, string> | undefined;

  return followUpTaskMap?.[taskId];
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

    const followUpGenerationId = getFollowUpGenerationId(metadata, taskId);
    const isFollowUpTask = Boolean(followUpGenerationId);

    if (
      (asyncTask.status === AsyncTaskStatus.Success ||
        asyncTask.status === AsyncTaskStatus.Error) &&
      !isFollowUpTask
    ) {
      return NextResponse.json({ success: true });
    }

    const asyncTaskModel = new AsyncTaskModel(db, asyncTask.userId);
    const generationModel = new GenerationModel(db, asyncTask.userId);
    const fileService = new FileService(db, asyncTask.userId);
    const generationIds = Array.isArray(metadata.generationIds) ? metadata.generationIds : [];
    const tracks = normalizeKieTracks(body?.data?.data, taskId, metadata.artist);
    const callbackStage = String(body?.data?.status || body?.status || '').toUpperCase();

    if (isFollowUpTask && body?.code === 200 && followUpGenerationId) {
      const generation = await generationModel.findByIdWithAsyncTask(followUpGenerationId);
      if (generation) {
        const asset = (generation.asset || {}) as Record<string, any>;

        if (Array.isArray(body?.data?.images) && body.data.images.length > 0) {
          const coverUrl = body.data.images[0];
          const coverExtension = coverUrl.split('?')[0].split('.').pop() || 'png';
          const coverPath = `generations/audio/${asyncTask.userId}/cover/${taskId}.${coverExtension}`;
          const coverFile = await fileService.uploadFromUrl(
            coverUrl,
            coverPath,
            FileSource.ImageGeneration,
          );

          await generationModel.update(followUpGenerationId, {
            asset: {
              ...asset,
              coverUrl: coverFile.key,
              metadata: {
                ...asset.metadata,
                coverImages: body.data.images,
                coverTaskId: taskId,
              },
            },
          });
        } else if (body?.data?.video_url || body?.data?.videoUrl) {
          const videoUrl = body.data.video_url || body.data.videoUrl;
          const videoExtension = videoUrl.split('?')[0].split('.').pop() || 'mp4';
          const videoPath = `generations/audio/${asyncTask.userId}/video/${taskId}.${videoExtension}`;
          const videoFile = await fileService.uploadFromUrl(
            videoUrl,
            videoPath,
            FileSource.VideoGeneration,
          );

          await generationModel.update(followUpGenerationId, {
            asset: {
              ...asset,
              metadata: {
                ...asset.metadata,
                videoTaskId: taskId,
                videoUrl: videoFile.key,
              },
              videoTaskId: taskId,
              videoUrl: videoFile.key,
            },
          });
        } else if (Array.isArray(body?.data?.data)) {
          await generationModel.update(followUpGenerationId, {
            asset: {
              ...asset,
              metadata: {
                ...asset.metadata,
                followUpCallback: body,
              },
            },
          });
        }
      }

      await asyncTaskModel.update(asyncTask.id, {
        metadata: {
          ...metadata,
          rawCallback: body,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (
      asyncTask.status === AsyncTaskStatus.Success ||
      asyncTask.status === AsyncTaskStatus.Error
    ) {
      return NextResponse.json({ success: true });
    }

    if (body?.code === 200 && tracks.length > 0 && generationIds.length > 0) {
      let nextMetadata = {
        ...metadata,
        rawCallback: body,
        tracks,
      };

      for (const [index, generationId] of generationIds.entries()) {
        const track = tracks[index];
        if (!track?.audioUrl) continue;

        nextMetadata = await persistKieTrack({
          fileService,
          generationId,
          generationModel,
          metadata: nextMetadata,
          track,
          userId: asyncTask.userId,
        });
      }

      const allTracksReady =
        callbackStage === 'COMPLETE' &&
        generationIds.every((generationId, index) => {
          return Boolean(tracks[index]?.audioUrl);
        });

      await asyncTaskModel.update(asyncTask.id, {
        metadata: nextMetadata,
        status: allTracksReady ? AsyncTaskStatus.Success : AsyncTaskStatus.Processing,
      });

      return NextResponse.json({ success: true });
    }

    if (body?.code === 200) {
      await asyncTaskModel.update(asyncTask.id, {
        metadata: {
          ...metadata,
          rawCallback: body,
          tracks,
        },
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
        tracks,
      },
      status: AsyncTaskStatus.Error,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[audio-webhook] Processing failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
