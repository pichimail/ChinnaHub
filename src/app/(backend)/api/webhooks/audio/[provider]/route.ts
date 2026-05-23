import { timingSafeEqual } from 'node:crypto';

import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@lobechat/types';
import { NextResponse } from 'next/server';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { getServerDB } from '@/database/server';

const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

export const POST = async (req: Request) => {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const taskId = body?.data?.taskId || body?.taskId;
  if (!taskId) return NextResponse.json({ success: true });

  const db = await getServerDB();
  const asyncTask = await AsyncTaskModel.findByInferenceId(db, taskId);
  if (!asyncTask) return NextResponse.json({ success: true });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const expectedToken = (asyncTask.metadata as any)?.webhookToken;
  if (!token || !expectedToken || !safeCompare(token, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (asyncTask.status === AsyncTaskStatus.Success || asyncTask.status === AsyncTaskStatus.Error) {
    return NextResponse.json({ success: true });
  }

  const statusRaw = body?.data?.status || body?.status || '';
  const status = String(statusRaw).toLowerCase();
  const variants = Array.isArray(body?.data?.response?.sunoData)
    ? body.data.response.sunoData
    : Array.isArray(body?.data?.sunoData)
      ? body.data.sunoData
      : [];
  const variant = variants[0] || body?.data?.response || body?.data || body;
  const audioUrl = variant?.streamAudioUrl || variant?.audioUrl || null;

  const asyncTaskModel = new AsyncTaskModel(db, asyncTask.userId);
  const generationModel = new GenerationModel(db, asyncTask.userId);
  const generation = await generationModel.findByAsyncTaskId(asyncTask.id);

  if (generation && audioUrl) {
    await generationModel.update(generation.id, {
      asset: {
        mimeType: 'audio/mpeg',
        originalUrl: audioUrl,
        thumbnailUrl: audioUrl,
        type: 'audio',
        url: audioUrl,
      } as any,
    });
  }

  if (
    status.includes('success') ||
    status.includes('complete') ||
    status.includes('first_success')
  ) {
    if (
      status.includes('success') &&
      !status.includes('text_success') &&
      !status.includes('first_success')
    ) {
      await asyncTaskModel.update(asyncTask.id, { status: AsyncTaskStatus.Success });
    }
    return NextResponse.json({ success: true });
  }

  if (status.includes('fail') || status.includes('error')) {
    await asyncTaskModel.update(asyncTask.id, {
      error: new AsyncTaskError(
        AsyncTaskErrorType.ServerError,
        body?.data?.errorMessage || body?.msg || 'Audio generation failed',
      ),
      status: AsyncTaskStatus.Error,
    });
  }

  return NextResponse.json({ success: true });
};
