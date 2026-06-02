import { z } from 'zod';

import { StudioProjectModel } from '@/database/models/studioProject';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const studioProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      studioProjectModel: new StudioProjectModel(ctx.serverDB, ctx.userId),
    },
  });
});

const projectIdInput = z.object({ projectId: z.string() });

export const studioRouter = router({
  listProjects: studioProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const projects = await ctx.studioProjectModel.listProjects(input?.limit ?? 50);
      return { projects };
    }),

  createProject: studioProcedure
    .input(
      z.object({
        description: z.string().optional(),
        initialPrompt: z.string().optional(),
        name: z.string().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.studioProjectModel.createProject({
        currentState: {
          initialPrompt: input.initialPrompt || '',
        },
        description: input.description,
        name: input.name,
        settings: {},
      });

      if (input.initialPrompt?.trim()) {
        await ctx.studioProjectModel.appendMessage({
          content: input.initialPrompt,
          metadata: { source: 'project-init' },
          projectId: project.id,
          role: 'user',
        });
      }

      return { project };
    }),

  getProject: studioProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const project = await ctx.studioProjectModel.findProjectById(input.projectId);
    return { project: project || null };
  }),

  listMessages: studioProcedure
    .input(projectIdInput.extend({ limit: z.number().min(1).max(500).default(120) }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.studioProjectModel.listMessages(input.projectId, input.limit);
      return { messages };
    }),

  appendMessage: studioProcedure
    .input(
      z.object({
        content: z.string().min(1),
        metadata: z.record(z.unknown()).optional(),
        projectId: z.string(),
        role: z.enum(['assistant', 'system', 'tool', 'user']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.studioProjectModel.appendMessage({
        content: input.content,
        metadata: input.metadata,
        projectId: input.projectId,
        role: input.role,
      });

      return { message };
    }),

  listSnapshots: studioProcedure
    .input(projectIdInput.extend({ limit: z.number().min(1).max(200).default(100) }))
    .query(async ({ ctx, input }) => {
      const snapshots = await ctx.studioProjectModel.listSnapshots(input.projectId, input.limit);
      return { snapshots };
    }),

  createSnapshot: studioProcedure
    .input(
      z.object({
        diff: z.record(z.unknown()).optional(),
        fileTree: z.record(z.unknown()).optional(),
        projectId: z.string(),
        summary: z.string().optional(),
        title: z.string().min(1).max(160),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const snapshot = await ctx.studioProjectModel.createSnapshot(input.projectId, {
        diff: input.diff,
        fileTree: input.fileTree,
        summary: input.summary,
        title: input.title,
      });

      return { snapshot };
    }),

  listDeployments: studioProcedure
    .input(projectIdInput.extend({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const deployments = await ctx.studioProjectModel.listDeployments(
        input.projectId,
        input.limit,
      );
      return { deployments };
    }),

  registerDeployment: studioProcedure
    .input(
      z.object({
        metadata: z.record(z.unknown()).optional(),
        projectId: z.string(),
        provider: z.string().default('vercel'),
        status: z.string().default('pending'),
        type: z.enum(['deploy', 'preview']),
        url: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.studioProjectModel.createDeployment({
        deploymentType: input.type,
        metadata: input.metadata,
        projectId: input.projectId,
        provider: input.provider,
        status: input.status,
        url: input.url,
      });

      return { deployment };
    }),
});

export type StudioRouter = typeof studioRouter;
