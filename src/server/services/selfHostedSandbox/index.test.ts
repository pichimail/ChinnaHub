import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SelfHostedSandboxService } from './index';

const createFileService = () =>
  ({
    createFileRecord: vi
      .fn()
      .mockResolvedValue({ fileId: 'file-1', url: 'https://app.test/f/file-1' }),
    uploadBuffer: vi.fn().mockResolvedValue({ key: 'uploaded-key' }),
  }) as any;

describe('SelfHostedSandboxService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'self-hosted-sandbox-test-'));
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('isolates file writes and reads inside the user topic workspace', async () => {
    const sandbox = new SelfHostedSandboxService({
      fileService: createFileService(),
      root,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const writeResult = await sandbox.callTool('writeFile', {
      content: '<html></html>',
      path: '/workspace/index.html',
    });
    expect(writeResult.success).toBe(true);

    const readResult = await sandbox.callTool('readFile', { path: '/workspace/index.html' });
    expect(readResult.success).toBe(true);
    expect(readResult.result.content).toBe('<html></html>');

    const listResult = await sandbox.callTool('listFiles', { directoryPath: '/workspace' });
    expect(listResult.success).toBe(true);
    expect(listResult.result.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'index.html' })]),
    );
  });

  it('executes JavaScript in the self-hosted fallback', async () => {
    const sandbox = new SelfHostedSandboxService({
      fileService: createFileService(),
      root,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await sandbox.callTool('executeCode', {
      code: 'console.log("hello", 42)',
      language: 'javascript',
    });

    expect(result.success).toBe(true);
    expect(result.result.output).toBe('hello 42');
    expect(result.result.exitCode).toBe(0);
  });

  it('exports files through FileService and returns a public file link', async () => {
    const fileService = createFileService();
    const sandbox = new SelfHostedSandboxService({
      fileService,
      root,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    await sandbox.callTool('writeFile', {
      content: '<html></html>',
      path: '/workspace/index.html',
    });

    const result = await sandbox.exportAndUploadFile('/workspace/index.html', 'index.html');

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://app.test/f/file-1');
    expect(fileService.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining('code-interpreter-exports/'),
      expect.any(Buffer),
      'text/html',
    );
  });

  it('rejects paths that escape the isolated workspace', async () => {
    const sandbox = new SelfHostedSandboxService({
      fileService: createFileService(),
      root,
      topicId: 'topic-1',
      userId: 'user-1',
    });

    const result = await sandbox.callTool('writeFile', {
      content: 'bad',
      path: '../../escape.txt',
    });

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('escapes the isolated workspace');
  });
});
