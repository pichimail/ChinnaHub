import { type ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import {
  type SandboxCallToolResult,
  type SandboxExportFileResult,
} from '@lobechat/builtin-tool-cloud-sandbox';
import { sha256 } from 'js-sha256';
import mime from 'mime';

import { type FileService } from '@/server/services/file';

const DEFAULT_ROOT = path.join(tmpdir(), 'chinnahub-self-hosted-sandbox');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SCRIPT_TIMEOUT_MS = 5000;
const MAX_COMMAND_TIMEOUT_MS = 120_000;

interface BackgroundCommand {
  command: string;
  cursor: number;
  error?: string;
  exitCode?: number;
  output: string[];
  process: ChildProcessWithoutNullStreams;
  running: boolean;
  timeout?: NodeJS.Timeout;
}

const backgroundCommands = new Map<string, BackgroundCommand>();

interface SelfHostedSandboxOptions {
  fileService: FileService;
  root?: string;
  topicId: string;
  userId: string;
}

const toRelativeSandboxPath = (inputPath: string) => {
  const normalized = inputPath.trim() || '.';
  const withoutLeadingSlash = normalized.replace(/^[/\\]+/, '');

  return withoutLeadingSlash || '.';
};

const getFileType = (filePath: string) => {
  const extension = path.extname(filePath).replace('.', '').toLowerCase();
  return extension || 'txt';
};

const pathMatches = (filePath: string, pattern?: string) => {
  if (!pattern) return true;

  const escaped = pattern
    .replaceAll('\\', '/')
    .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
    .replaceAll('**', '__GLOBSTAR__')
    .replaceAll('*', '[^/]*')
    .replaceAll('__GLOBSTAR__', '.*');

  return new RegExp(`^${escaped}$`, 'i').test(filePath.replaceAll('\\', '/'));
};

const createOutputCapture = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const format = (values: unknown[]) =>
    values.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' ');

  return {
    console: {
      error: (...values: unknown[]) => {
        stderr.push(format(values));
      },
      info: (...values: unknown[]) => {
        stdout.push(format(values));
      },
      log: (...values: unknown[]) => {
        stdout.push(format(values));
      },
      warn: (...values: unknown[]) => {
        stderr.push(format(values));
      },
    },
    stderr,
    stdout,
  };
};

/**
 * Lightweight self-hosted fallback for core sandbox artifact workflows.
 *
 * This intentionally handles file state and direct JS/TS execution only. Full shell
 * command execution stays on the Market-backed sandbox because it requires a real
 * isolated container boundary.
 */
export class SelfHostedSandboxService {
  private fileService: FileService;
  private root: string;
  private topicId: string;
  private userId: string;

  constructor(options: SelfHostedSandboxOptions) {
    this.fileService = options.fileService;
    this.topicId = options.topicId;
    this.userId = options.userId;
    this.root = path.join(
      options.root || DEFAULT_ROOT,
      sha256(`${options.userId}:${options.topicId}`).slice(0, 32),
    );
  }

  async callTool(toolName: string, params: Record<string, any>): Promise<SandboxCallToolResult> {
    try {
      await this.ensureRoot();

      switch (toolName) {
        case 'writeFile':
        case 'writeLocalFile': {
          return await this.writeLocalFile(params);
        }

        case 'readFile':
        case 'readLocalFile': {
          return await this.readLocalFile(params);
        }

        case 'listFiles':
        case 'listLocalFiles': {
          return await this.listLocalFiles(params);
        }

        case 'editFile':
        case 'editLocalFile': {
          return await this.editLocalFile(params);
        }

        case 'moveFiles':
        case 'moveLocalFiles': {
          return await this.moveLocalFiles(params);
        }

        case 'searchFiles':
        case 'searchLocalFiles': {
          return await this.searchLocalFiles(params);
        }

        case 'grepContent': {
          return await this.grepContent(params);
        }

        case 'globFiles':
        case 'globLocalFiles': {
          return await this.globFiles(params);
        }

        case 'executeCode': {
          return await this.executeCode(params);
        }

        case 'runCommand': {
          return await this.runCommand(params);
        }

        case 'getCommandOutput': {
          return this.getCommandOutput(params);
        }

        case 'killCommand': {
          return this.killCommand(params);
        }

        default: {
          return {
            error: {
              message:
                'Self-hosted sandbox fallback supports artifact files and direct JS/TS code execution. Full shell execution requires Market Cloud Sandbox trusted-client configuration.',
              name: 'UnsupportedSelfHostedSandboxTool',
            },
            result: null,
            success: false,
          };
        }
      }
    } catch (error) {
      return {
        error: { message: error instanceof Error ? error.message : String(error) },
        result: null,
        success: false,
      };
    }
  }

  async exportAndUploadFile(pathname: string, filename: string): Promise<SandboxExportFileResult> {
    try {
      await this.ensureRoot();

      const sourcePath = this.resolveSandboxPath(pathname);
      const bytes = await readFile(sourcePath);
      const mimeType = mime.getType(filename) || 'application/octet-stream';
      const today = new Date().toISOString().split('T')[0];
      const safeFileName = path.basename(filename || path.basename(pathname) || 'exported_file');
      const key = `code-interpreter-exports/${today}/${this.topicId}/${safeFileName}`;

      await this.fileService.uploadBuffer(key, bytes, mimeType);

      const { fileId, url } = await this.fileService.createFileRecord({
        fileHash: sha256(bytes),
        fileType: mimeType,
        name: safeFileName,
        size: bytes.length,
        url: key,
      });

      return {
        fileId,
        filename: safeFileName,
        mimeType,
        size: bytes.length,
        success: true,
        url,
      };
    } catch (error) {
      return {
        error: { message: error instanceof Error ? error.message : String(error) },
        filename,
        success: false,
      };
    }
  }

  private async editLocalFile(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const filePath = this.resolveSandboxPath(String(params.path || ''));
    const current = await readFile(filePath, 'utf8');
    const search = String(params.search ?? '');
    const replace = String(params.replace ?? '');
    const next = params.all
      ? current.replaceAll(search, replace)
      : current.replace(search, replace);
    const replacements = current === next ? 0 : params.all ? current.split(search).length - 1 : 1;

    await writeFile(filePath, next);

    return { result: { path: params.path, replacements }, success: true };
  }

  private async executeCode(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const language = String(params.language || 'python').toLowerCase();

    if (language === 'python') {
      const code = String(params.code || '');
      const result = await this.runCommand({
        command: `python3 - <<'PY'\n${code}\nPY`,
        timeout: SCRIPT_TIMEOUT_MS,
      });

      if (result.success) return result;

      return {
        result: {
          error:
            result.result?.error ||
            'Python code preview runs in the browser-side Python preview. Server-side Python execution requires python3 in the app runtime or the isolated Market Cloud Sandbox.',
          exitCode: 1,
          output: '',
          stderr: result.result?.stderr || result.error?.message || 'python3 is not available',
        },
        success: false,
      };
    }

    if (language === 'typescript') {
      return {
        result: {
          error:
            'TypeScript server execution is unavailable in the self-hosted fallback. TSX/TS previews are rendered in the browser-side React preview.',
          exitCode: 1,
          output: '',
          stderr:
            'TypeScript execution requires the isolated Market Cloud Sandbox or precompiled JavaScript.',
        },
        success: false,
      };
    }

    if (language !== 'javascript') {
      return {
        error: { message: `Unsupported language in self-hosted sandbox fallback: ${language}` },
        result: null,
        success: false,
      };
    }

    const code = String(params.code || '');
    const output = createOutputCapture();
    const context = vm.createContext({
      console: output.console,
      setTimeout,
    });

    try {
      const script = new vm.Script(code);
      const result = script.runInContext(context, { timeout: SCRIPT_TIMEOUT_MS });
      if (result !== undefined) output.stdout.push(String(result));

      return {
        result: {
          exitCode: 0,
          output: output.stdout.join('\n'),
          stderr: output.stderr.join('\n'),
          stdout: output.stdout.join('\n'),
        },
        success: true,
      };
    } catch (error) {
      return {
        result: {
          error: error instanceof Error ? error.message : String(error),
          exitCode: 1,
          output: output.stdout.join('\n'),
          stderr: [...output.stderr, error instanceof Error ? error.message : String(error)].join(
            '\n',
          ),
          stdout: output.stdout.join('\n'),
        },
        success: false,
      };
    }
  }

  private async globFiles(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const directory = this.resolveSandboxPath(String(params.directory || '.'));
    const files = await this.walk(directory);
    const base = this.relativeFromRoot(directory);
    const matches = files
      .map((file) => this.relativeFromRoot(file))
      .filter((file) =>
        pathMatches(base === '.' ? file : path.relative(base, file), params.pattern),
      );

    return { result: { files: matches, totalCount: matches.length }, success: true };
  }

  private async grepContent(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const directory = this.resolveSandboxPath(String(params.directory || '.'));
    const files = await this.walk(directory);
    const pattern = new RegExp(String(params.pattern || ''), 'g');
    const matches = [];

    for (const file of files) {
      const relativePath = this.relativeFromRoot(file);
      if (!pathMatches(relativePath, params.filePattern)) continue;

      const content = await readFile(file, 'utf8');
      const lines = content.split('\n');

      for (const [index, line] of lines.entries()) {
        if (pattern.test(line)) {
          matches.push({ line, lineNumber: index + 1, path: relativePath });
        }
        pattern.lastIndex = 0;
      }
    }

    return { result: { matches, totalMatches: matches.length }, success: true };
  }

  private async listLocalFiles(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const directory = this.resolveSandboxPath(String(params.directoryPath || '.'));
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(directory, entry.name);
        const info = await stat(entryPath);

        return {
          isDirectory: entry.isDirectory(),
          modifiedAt: info.mtime.toISOString(),
          name: entry.name,
          path: this.relativeFromRoot(entryPath),
          size: info.size,
        };
      }),
    );

    return { result: { files, totalCount: files.length }, success: true };
  }

  private async moveLocalFiles(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const operations = Array.isArray(params.operations) ? params.operations : [];
    const results = [];

    for (const operation of operations) {
      try {
        const source = this.resolveSandboxPath(String(operation.source || ''));
        const destination = this.resolveSandboxPath(String(operation.destination || ''));
        await mkdir(path.dirname(destination), { recursive: true });
        await rename(source, destination);
        results.push({
          destination: operation.destination,
          source: operation.source,
          success: true,
        });
      } catch (error) {
        results.push({
          destination: operation.destination,
          error: error instanceof Error ? error.message : String(error),
          source: operation.source,
          success: false,
        });
      }
    }

    return {
      result: {
        results,
        successCount: results.filter((result) => result.success).length,
      },
      success: true,
    };
  }

  private async readLocalFile(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const filePath = this.resolveSandboxPath(String(params.path || ''));
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const startLine = Number(params.startLine || 1);
    const endLine = Number(params.endLine || lines.length);
    const selected = lines.slice(startLine - 1, endLine).join('\n');

    return {
      result: {
        charCount: selected.length,
        content: selected,
        fileType: getFileType(filePath),
        filename: path.basename(filePath),
        loc: selected.split('\n').length,
        totalCharCount: content.length,
        totalLineCount: lines.length,
      },
      success: true,
    };
  }

  private getCommandOutput(params: Record<string, any>): SandboxCallToolResult {
    const commandId = String(params.commandId || '');
    const command = backgroundCommands.get(commandId);

    if (!command) {
      return {
        error: { message: `Command not found: ${commandId}` },
        result: null,
        success: false,
      };
    }

    const newOutput = command.output.slice(command.cursor).join('');
    command.cursor = command.output.length;

    return {
      result: {
        error: command.error,
        exitCode: command.exitCode,
        newOutput,
        output: newOutput,
        running: command.running,
        success: !command.error,
      },
      success: true,
    };
  }

  private killCommand(params: Record<string, any>): SandboxCallToolResult {
    const commandId = String(params.commandId || '');
    const command = backgroundCommands.get(commandId);

    if (!command) {
      return {
        error: { message: `Command not found: ${commandId}` },
        result: null,
        success: false,
      };
    }

    if (command.timeout) clearTimeout(command.timeout);
    command.process.kill('SIGTERM');
    command.running = false;
    command.error = command.error || 'Command killed';

    return {
      result: { commandId, error: command.error, success: true },
      success: true,
    };
  }

  private async runCommand(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const command = String(params.command || '').trim();

    if (!command) {
      return { error: { message: 'Command is required' }, result: null, success: false };
    }

    const timeout = Math.min(
      Math.max(Number(params.timeout || MAX_COMMAND_TIMEOUT_MS), 1000),
      MAX_COMMAND_TIMEOUT_MS,
    );

    if (params.background) {
      const commandId = randomUUID();
      const child = this.spawnShell(command);
      const backgroundCommand: BackgroundCommand = {
        command,
        cursor: 0,
        output: [],
        process: child,
        running: true,
      };

      child.stdout.on('data', (data) => backgroundCommand.output.push(String(data)));
      child.stderr.on('data', (data) => backgroundCommand.output.push(String(data)));
      child.on('error', (error) => {
        backgroundCommand.error = error.message;
        backgroundCommand.running = false;
      });
      child.on('close', (exitCode) => {
        if (backgroundCommand.timeout) clearTimeout(backgroundCommand.timeout);
        backgroundCommand.exitCode = exitCode ?? undefined;
        backgroundCommand.running = false;
      });
      backgroundCommand.timeout = setTimeout(() => {
        backgroundCommand.error = `Command timed out after ${timeout}ms`;
        backgroundCommand.process.kill('SIGTERM');
      }, timeout);

      backgroundCommands.set(commandId, backgroundCommand);

      return {
        result: { commandId, output: '', running: true, shell_id: commandId, success: true },
        success: true,
      };
    }

    const result = await new Promise<{
      error?: string;
      exitCode?: number;
      stderr: string;
      stdout: string;
    }>((resolve) => {
      const child = this.spawnShell(command);
      const stdout: string[] = [];
      const stderr: string[] = [];
      let completed = false;

      const finish = (value: {
        error?: string;
        exitCode?: number;
        stderr: string;
        stdout: string;
      }) => {
        if (completed) return;
        completed = true;
        resolve(value);
      };

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        finish({
          error: `Command timed out after ${timeout}ms`,
          exitCode: 124,
          stderr: stderr.join(''),
          stdout: stdout.join(''),
        });
      }, timeout);

      child.stdout.on('data', (data) => stdout.push(String(data)));
      child.stderr.on('data', (data) => stderr.push(String(data)));
      child.on('error', (error) => {
        clearTimeout(timer);
        finish({
          error: error.message,
          exitCode: 1,
          stderr: stderr.join(''),
          stdout: stdout.join(''),
        });
      });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        finish({
          exitCode: exitCode ?? undefined,
          stderr: stderr.join(''),
          stdout: stdout.join(''),
        });
      });
    });

    return {
      result: {
        error: result.error,
        exitCode: result.exitCode,
        output: result.stdout,
        stderr: result.stderr,
        stdout: result.stdout,
      },
      success: !result.error && (result.exitCode === 0 || result.exitCode === undefined),
    };
  }

  private async searchLocalFiles(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const directory = this.resolveSandboxPath(String(params.directory || '.'));
    const files = await this.walk(directory);
    const keyword = String(params.keyword || '').toLowerCase();
    const fileType = String(params.fileType || '')
      .replace(/^\./, '')
      .toLowerCase();
    const results = files
      .map((file) => this.relativeFromRoot(file))
      .filter((file) => !keyword || file.toLowerCase().includes(keyword))
      .filter((file) => !fileType || file.toLowerCase().endsWith(`.${fileType}`))
      .map((file) => ({ path: file }));

    return { result: { results, totalCount: results.length }, success: true };
  }

  private async writeLocalFile(params: Record<string, any>): Promise<SandboxCallToolResult> {
    const filePath = this.resolveSandboxPath(String(params.path || ''));
    const content = String(params.content ?? '');
    const bytes = Buffer.byteLength(content);

    if (bytes > MAX_FILE_BYTES) {
      return {
        error: { message: `File exceeds self-hosted sandbox limit of ${MAX_FILE_BYTES} bytes` },
        result: null,
        success: false,
      };
    }

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);

    return { result: { bytesWritten: bytes, path: params.path, success: true }, success: true };
  }

  private spawnShell(command: string) {
    return spawn('/bin/sh', ['-lc', command], {
      cwd: this.root,
      env: {
        HOME: this.root,
        LANG: 'C.UTF-8',
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        SANDBOX_TOPIC_ID: this.topicId,
        SANDBOX_USER_ID: this.userId,
        SANDBOX_WORKSPACE: this.root,
      },
    });
  }

  private async ensureRoot() {
    await mkdir(this.root, { recursive: true });
  }

  private relativeFromRoot(resolvedPath: string) {
    const relativePath = path.relative(this.root, resolvedPath);
    return relativePath || '.';
  }

  private resolveSandboxPath(inputPath: string) {
    const resolved = path.resolve(this.root, toRelativeSandboxPath(inputPath));

    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Sandbox path escapes the isolated workspace');
    }

    return resolved;
  }

  private async walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walk(entryPath)));
      } else {
        files.push(entryPath);
      }
    }

    return files;
  }
}
