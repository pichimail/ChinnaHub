import { lambdaClient } from '@/libs/trpc/client';

interface CreateStudioProjectParams {
  description?: string;
  initialPrompt?: string;
  name: string;
}

export class StudioService {
  listProjects = async (limit = 50) => lambdaClient.studio.listProjects.query({ limit });

  createProject = async (params: CreateStudioProjectParams) =>
    lambdaClient.studio.createProject.mutate(params);

  getProject = async (projectId: string) => lambdaClient.studio.getProject.query({ projectId });

  listMessages = async (projectId: string, limit = 120) =>
    lambdaClient.studio.listMessages.query({ limit, projectId });

  appendMessage = async (params: {
    content: string;
    metadata?: Record<string, unknown>;
    projectId: string;
    role: 'assistant' | 'system' | 'tool' | 'user';
  }) => lambdaClient.studio.appendMessage.mutate(params);

  listSnapshots = async (projectId: string, limit = 100) =>
    lambdaClient.studio.listSnapshots.query({ limit, projectId });

  createSnapshot = async (params: {
    diff?: Record<string, unknown>;
    fileTree?: Record<string, unknown>;
    projectId: string;
    summary?: string;
    title: string;
  }) => lambdaClient.studio.createSnapshot.mutate(params);

  listDeployments = async (projectId: string, limit = 20) =>
    lambdaClient.studio.listDeployments.query({ limit, projectId });

  registerDeployment = async (params: {
    metadata?: Record<string, unknown>;
    projectId: string;
    provider?: string;
    status?: string;
    type: 'deploy' | 'preview';
    url: string;
  }) => lambdaClient.studio.registerDeployment.mutate(params);
}

export const studioService = new StudioService();
