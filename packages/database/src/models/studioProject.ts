import { and, desc, eq } from 'drizzle-orm';

import {
  type NewStudioDeployment,
  type NewStudioMessage,
  type NewStudioProject,
  type NewStudioSnapshot,
  studioDeployments,
  studioMessages,
  studioProjects,
  studioSnapshots,
} from '../schemas/studio';
import type { LobeChatDatabase } from '../type';

export class StudioProjectModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  listProjects = async (limit = 50) => {
    const projects = await this.db.query.studioProjects.findMany({
      limit,
      orderBy: [desc(studioProjects.updatedAt)],
      where: eq(studioProjects.userId, this.userId),
    });

    const enriched = await Promise.all(
      projects.map(async (project) => {
        const latestSnapshot = await this.db.query.studioSnapshots.findFirst({
          columns: { version: true },
          orderBy: [desc(studioSnapshots.version)],
          where: and(
            eq(studioSnapshots.projectId, project.id),
            eq(studioSnapshots.userId, this.userId),
          ),
        });

        return {
          ...project,
          latestVersion: latestSnapshot?.version ?? 0,
        };
      }),
    );

    return enriched;
  };

  createProject = async (project: Omit<NewStudioProject, 'userId'>) => {
    const [created] = await this.db
      .insert(studioProjects)
      .values({ ...project, userId: this.userId })
      .returning();

    return created;
  };

  findProjectById = async (projectId: string) => {
    return this.db.query.studioProjects.findFirst({
      where: and(eq(studioProjects.id, projectId), eq(studioProjects.userId, this.userId)),
    });
  };

  listMessages = async (projectId: string, limit = 120) => {
    return this.db.query.studioMessages.findMany({
      limit,
      orderBy: [desc(studioMessages.createdAt)],
      where: and(eq(studioMessages.projectId, projectId), eq(studioMessages.userId, this.userId)),
    });
  };

  appendMessage = async (message: Omit<NewStudioMessage, 'userId'>) => {
    const [created] = await this.db
      .insert(studioMessages)
      .values({ ...message, userId: this.userId })
      .returning();

    await this.touchProject(message.projectId);

    return created;
  };

  listSnapshots = async (projectId: string, limit = 100) => {
    return this.db.query.studioSnapshots.findMany({
      limit,
      orderBy: [desc(studioSnapshots.version)],
      where: and(eq(studioSnapshots.projectId, projectId), eq(studioSnapshots.userId, this.userId)),
    });
  };

  createSnapshot = async (
    projectId: string,
    snapshot: Omit<NewStudioSnapshot, 'projectId' | 'userId' | 'version'>,
  ) => {
    const latest = await this.db.query.studioSnapshots.findFirst({
      columns: { version: true },
      orderBy: [desc(studioSnapshots.version)],
      where: and(eq(studioSnapshots.projectId, projectId), eq(studioSnapshots.userId, this.userId)),
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    const [created] = await this.db
      .insert(studioSnapshots)
      .values({
        ...snapshot,
        projectId,
        userId: this.userId,
        version: nextVersion,
      })
      .returning();

    await this.touchProject(projectId);

    return created;
  };

  listDeployments = async (projectId: string, limit = 20) => {
    return this.db.query.studioDeployments.findMany({
      limit,
      orderBy: [desc(studioDeployments.createdAt)],
      where: and(
        eq(studioDeployments.projectId, projectId),
        eq(studioDeployments.userId, this.userId),
      ),
    });
  };

  createDeployment = async (deployment: Omit<NewStudioDeployment, 'userId'>) => {
    const [created] = await this.db
      .insert(studioDeployments)
      .values({ ...deployment, userId: this.userId })
      .returning();

    await this.touchProject(deployment.projectId);

    return created;
  };

  private touchProject = async (projectId: string) => {
    await this.db
      .update(studioProjects)
      .set({ updatedAt: new Date() })
      .where(and(eq(studioProjects.id, projectId), eq(studioProjects.userId, this.userId)));
  };
}
