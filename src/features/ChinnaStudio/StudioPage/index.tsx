'use client';

import { Flexbox } from '@lobehub/ui';
import { Badge, Button, Empty, Input, message, Skeleton } from 'antd';
import { createStaticStyles } from 'antd-style';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { studioService } from '@/services/studio';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/selectors';

type PreviewMode = 'auto' | 'fallback' | 'self-hosted';

const styles = createStaticStyles(({ css, cssVar }) => ({
  chatArea: css`
    min-height: 360px;
    padding-block: 20px;
    padding-inline: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};

    background: linear-gradient(180deg, ${cssVar.colorFillQuaternary} 0%, transparent 100%);
  `,
  chatBubble: css`
    max-width: min(680px, 100%);
    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius}px;

    background: ${cssVar.colorBgContainer};
  `,
  hint: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  panel: css`
    padding-block: 20px;
    padding-inline: 20px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 88%, transparent);
  `,
  previewCard: css`
    gap: 10px;

    width: 100%;
    min-height: 260px;
    padding-block: 14px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius}px;

    background: ${cssVar.colorBgContainer};
  `,
  previewFrame: css`
    overflow: hidden;

    width: 100%;
    min-height: 380px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius}px;
  `,
  previewIframe: css`
    width: 100%;
    height: 100%;
    min-height: 380px;
    border: none;
  `,
  previewModeBtn: css`
    min-width: 116px;
  `,
  projectItem: css`
    cursor: pointer;
    transition: border-color 0.2s ease;

    &:hover {
      border-color: ${cssVar.colorPrimaryBorder};
    }
  `,
  projectItemActive: css`
    border-color: ${cssVar.colorPrimaryBorder};
    box-shadow: 0 0 0 1px ${cssVar.colorPrimaryBorder};
  `,
  sectionTitle: css`
    font-size: 16px;
    font-weight: 600;
  `,
  shell: css`
    width: 100%;
    height: 100%;
    padding-block: 20px;
    padding-inline: 20px;
  `,
  suggestionButton: css`
    justify-content: flex-start;
    text-align: start;
    white-space: normal;
  `,
  title: css`
    font-size: 24px;
    font-weight: 700;
  `,
}));

const PROJECTS_SWR_KEY = 'studio:projects';

const getMessagesSWRKey = (projectId?: string) =>
  projectId ? ['studio:messages', projectId] : null;

const getSnapshotsSWRKey = (projectId?: string) =>
  projectId ? ['studio:snapshots', projectId] : null;

const getDeploymentsSWRKey = (projectId?: string) =>
  projectId ? ['studio:deployments', projectId] : null;

const getPreviewDescription = (mode: PreviewMode, hasSelfHostedUrl: boolean) => {
  if (mode === 'fallback') return 'Fallback preview: React-rendered mock for instant feedback.';
  if (mode === 'self-hosted') {
    return hasSelfHostedUrl
      ? 'Self-hosted preview: live iframe from your own preview URL.'
      : 'Self-hosted preview requested but no ready URL is available.';
  }

  return hasSelfHostedUrl
    ? 'Auto mode: using self-hosted iframe preview.'
    : 'Auto mode: no self-hosted URL found, using fallback preview.';
};

const getSuggestedPrompts = (projectName?: string, messageCount = 0) => {
  const project = projectName || 'your app';

  if (messageCount <= 1) {
    return [
      `Add Google authentication and make ${project} owner the default admin`,
      'Create a dashboard with mobile horizontal swipe cards and quick actions',
      'Add pricing plans with Starter, Pro, Enterprise and usage limits',
      'Generate Supabase schema and RLS policies scoped by user_id and project_id',
      'Set up PWA install prompt with bottom navigation for mobile users',
      'Add an admin page to manage feature flags and plan capabilities',
    ];
  }

  return [
    `Create a version snapshot before the next major change in ${project}`,
    'Add deployment panel showing preview URL and production deploy URL',
    'Improve accessibility with keyboard navigation and focus-visible states',
    'Add one-click Stripe integration with webhook handling and billing sync',
    'Create integration modules for Resend email, storage, maps, and analytics',
    'Generate export ZIP with README, .env.example, scripts, and deployment notes',
  ];
};

const StudioPage = () => {
  const { t } = useTranslation('common');
  const { mutate } = useSWRConfig();

  const isLogin = useUserStore(authSelectors.isLogin);
  const userEmail = useUserStore(userProfileSelectors.email);
  const { enableStudioBuilder } = useServerConfigStore(featureFlagsSelectors);

  const [projectName, setProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [prompt, setPrompt] = useState('');
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('auto');
  const [isSending, setIsSending] = useState(false);

  const { data: projectData, isLoading: isProjectsLoading } = useSWR(
    PROJECTS_SWR_KEY,
    () => studioService.listProjects(),
    { revalidateOnFocus: false },
  );

  const projects = projectData?.projects || [];

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const messagesKey = getMessagesSWRKey(selectedProjectId);
  const { data: messagesData, isLoading: isMessagesLoading } = useSWR(messagesKey, () =>
    selectedProjectId
      ? studioService.listMessages(selectedProjectId)
      : Promise.resolve({ messages: [] }),
  );

  const projectMessages = useMemo(() => {
    const messages = messagesData?.messages || [];
    return [...messages].reverse();
  }, [messagesData?.messages]);

  const snapshotsKey = getSnapshotsSWRKey(selectedProjectId);
  const { data: snapshotsData } = useSWR(snapshotsKey, () =>
    selectedProjectId
      ? studioService.listSnapshots(selectedProjectId, 20)
      : Promise.resolve({ snapshots: [] }),
  );

  const deploymentsKey = getDeploymentsSWRKey(selectedProjectId);
  const { data: deploymentsData } = useSWR(deploymentsKey, () =>
    selectedProjectId
      ? studioService.listDeployments(selectedProjectId, 20)
      : Promise.resolve({ deployments: [] }),
  );

  const snapshots = snapshotsData?.snapshots || [];
  const deployments = deploymentsData?.deployments || [];

  const readyPreviewDeployments = useMemo(
    () =>
      deployments.filter(
        (item) =>
          item.deploymentType === 'preview' &&
          item.status === 'ready' &&
          typeof item.url === 'string' &&
          item.url.length > 0,
      ),
    [deployments],
  );

  const latestReadyPreviewUrl = readyPreviewDeployments[0]?.url;
  const hasSelfHostedPreview = !!latestReadyPreviewUrl;

  const effectivePreviewMode: Exclude<PreviewMode, 'auto'> = useMemo(() => {
    if (previewMode === 'fallback') return 'fallback';
    if (previewMode === 'self-hosted') return 'self-hosted';
    return hasSelfHostedPreview ? 'self-hosted' : 'fallback';
  }, [previewMode, hasSelfHostedPreview]);

  const suggestedPrompts = useMemo(
    () => getSuggestedPrompts(selectedProject?.name, projectMessages.length),
    [projectMessages.length, selectedProject?.name],
  );

  const createProject = async () => {
    const nextName = projectName.trim();
    if (!nextName) return;

    try {
      const result = await studioService.createProject({ name: nextName });
      setProjectName('');
      setSelectedProjectId(result.project.id);
      await mutate(PROJECTS_SWR_KEY);
      message.success('Project created');
    } catch {
      message.error('Could not create project');
    }
  };

  const sendPrompt = async (value?: string) => {
    if (!selectedProjectId) {
      message.warning('Create or select a project first');
      return;
    }

    const content = (value ?? prompt).trim();
    if (!content) return;

    setIsSending(true);

    try {
      await studioService.appendMessage({
        content,
        metadata: { source: 'studio-user' },
        projectId: selectedProjectId,
        role: 'user',
      });

      await studioService.appendMessage({
        content:
          'Requirement captured. Next, I can update UI, schema, routes, and policies for this project scope.',
        metadata: { source: 'studio-system' },
        projectId: selectedProjectId,
        role: 'assistant',
      });

      setPrompt('');
      await Promise.all([mutate(messagesKey), mutate(PROJECTS_SWR_KEY)]);
    } catch {
      message.error('Could not send prompt');
    } finally {
      setIsSending(false);
    }
  };

  const saveSnapshot = async () => {
    if (!selectedProjectId) {
      message.warning('Select a project first');
      return;
    }

    const title = snapshotTitle.trim() || `Snapshot ${dayjs().format('YYYY-MM-DD HH:mm')}`;

    try {
      await studioService.createSnapshot({
        diff: {
          messageCount: projectMessages.length,
        },
        fileTree: {
          root: 'app',
        },
        projectId: selectedProjectId,
        summary: 'Manual Studio snapshot',
        title,
      });
      setSnapshotTitle('');
      await Promise.all([mutate(snapshotsKey), mutate(PROJECTS_SWR_KEY)]);
      message.success('Snapshot saved');
    } catch {
      message.error('Could not save snapshot');
    }
  };

  const addPreviewDeployment = async () => {
    if (!selectedProjectId) {
      message.warning('Select a project first');
      return;
    }

    const url = previewUrl.trim();
    if (!url) return;

    try {
      await studioService.registerDeployment({
        projectId: selectedProjectId,
        status: 'ready',
        type: 'preview',
        url,
      });
      setPreviewUrl('');
      await mutate(deploymentsKey);
      message.success('Preview URL added');
    } catch {
      message.error('Could not add preview URL');
    }
  };

  if (!isLogin) {
    return (
      <Flexbox align={'center'} className={styles.shell} justify={'center'}>
        <Empty description={t('tab.studio')} />
      </Flexbox>
    );
  }

  if (!enableStudioBuilder) {
    return (
      <Flexbox align={'center'} className={styles.shell} justify={'center'}>
        <Empty description={'Chinna Studio is disabled for this workspace'} />
      </Flexbox>
    );
  }

  return (
    <Flexbox className={styles.shell} gap={16}>
      <Flexbox horizontal justify={'space-between'}>
        <Flexbox gap={2}>
          <span className={styles.title}>{t('tab.studio')}</span>
          <span className={styles.hint}>
            Conversational full-stack app builder with project memory and versioned history
          </span>
        </Flexbox>
        <Badge color={'geekblue'} text={`Admin seed: ${userEmail || 'not available'}`} />
      </Flexbox>

      <Flexbox horizontal gap={16} style={{ minHeight: 0 }}>
        <Flexbox className={styles.panel} flex={2} gap={16}>
          <Flexbox gap={10}>
            <Flexbox horizontal justify={'space-between'}>
              <span className={styles.sectionTitle}>Live Preview</span>
              <Flexbox horizontal>
                <Button
                  className={styles.previewModeBtn}
                  type={previewMode === 'auto' ? 'primary' : 'default'}
                  onClick={() => setPreviewMode('auto')}
                >
                  Auto
                </Button>
                <Button
                  className={styles.previewModeBtn}
                  type={previewMode === 'self-hosted' ? 'primary' : 'default'}
                  onClick={() => setPreviewMode('self-hosted')}
                >
                  Self-hosted
                </Button>
                <Button
                  className={styles.previewModeBtn}
                  type={previewMode === 'fallback' ? 'primary' : 'default'}
                  onClick={() => setPreviewMode('fallback')}
                >
                  Fallback
                </Button>
              </Flexbox>
            </Flexbox>

            <span className={styles.hint}>
              {getPreviewDescription(previewMode, hasSelfHostedPreview)}
            </span>

            {effectivePreviewMode === 'self-hosted' && latestReadyPreviewUrl ? (
              <div className={styles.previewFrame}>
                <iframe
                  className={styles.previewIframe}
                  referrerPolicy={'strict-origin-when-cross-origin'}
                  sandbox={'allow-scripts allow-forms allow-modals'}
                  src={latestReadyPreviewUrl}
                  title={'studio-live-preview'}
                />
              </div>
            ) : (
              <Flexbox className={styles.previewCard}>
                <strong>{selectedProject?.name || 'Untitled Project'}</strong>
                <span className={styles.hint}>Fallback render (React/HTML scaffold preview)</span>
                <Flexbox horizontal justify={'space-between'}>
                  <Badge color={'blue'} text={`Messages: ${projectMessages.length}`} />
                  <Badge color={'green'} text={`Snapshots: ${snapshots.length}`} />
                </Flexbox>
                <div className={styles.chatBubble}>
                  <strong>Mobile Dashboard</strong>
                  <p>
                    Swipeable summary cards, bottom navigation, and install prompt enabled for PWA.
                  </p>
                </div>
                <div className={styles.chatBubble}>
                  <strong>Backend & Security</strong>
                  <p>
                    Supabase-ready schema, project-scoped data model, and RLS per user and project.
                  </p>
                </div>
              </Flexbox>
            )}
          </Flexbox>

          <Flexbox className={styles.chatArea} gap={12}>
            {isMessagesLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : projectMessages.length === 0 ? (
              <Flexbox className={styles.chatBubble}>
                Describe your app in Telugu, English, or Tinglish. I will keep project context and
                apply incremental changes.
              </Flexbox>
            ) : (
              <Flexbox gap={8}>
                {projectMessages.map((chat) => (
                  <Flexbox className={styles.chatBubble} key={chat.id}>
                    <Flexbox horizontal justify={'space-between'}>
                      <strong>{chat.role}</strong>
                      <span className={styles.hint}>
                        {dayjs(chat.createdAt).format('YYYY-MM-DD HH:mm')}
                      </span>
                    </Flexbox>
                    <span>{chat.content}</span>
                  </Flexbox>
                ))}
              </Flexbox>
            )}

            <Flexbox horizontal>
              <Input.TextArea
                autoSize={{ maxRows: 5, minRows: 2 }}
                placeholder={'Describe what to build next...'}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onPressEnter={(event) => {
                  if (event.shiftKey) return;
                  event.preventDefault();
                  void sendPrompt();
                }}
              />
              <Button loading={isSending} type={'primary'} onClick={() => sendPrompt()}>
                Send
              </Button>
            </Flexbox>

            <Flexbox gap={8}>
              <span className={styles.hint}>Suggested next prompts</span>
              <Flexbox gap={8}>
                {suggestedPrompts.map((suggestion) => (
                  <Button
                    block
                    className={styles.suggestionButton}
                    key={suggestion}
                    type={'default'}
                    onClick={() => void sendPrompt(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </Flexbox>
            </Flexbox>
          </Flexbox>
        </Flexbox>

        <Flexbox className={styles.panel} flex={1} gap={12}>
          <span className={styles.sectionTitle}>Projects</span>
          <Flexbox horizontal>
            <Input
              placeholder={'New project name'}
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              onPressEnter={createProject}
            />
            <Button type={'primary'} onClick={createProject}>
              Create
            </Button>
          </Flexbox>

          {isProjectsLoading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : projects.length === 0 ? (
            <Empty description={'No studio projects yet'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Flexbox gap={8}>
              {projects.map((project) => (
                <Flexbox
                  key={project.id}
                  className={`${styles.chatBubble} ${styles.projectItem} ${
                    selectedProjectId === project.id ? styles.projectItemActive : ''
                  }`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <Flexbox horizontal justify={'space-between'}>
                    <strong>{project.name}</strong>
                    <span className={styles.hint}>v{project.latestVersion ?? 0}</span>
                  </Flexbox>
                  <span className={styles.hint}>
                    Updated {dayjs(project.updatedAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                </Flexbox>
              ))}
            </Flexbox>
          )}

          <span className={styles.sectionTitle}>Snapshots</span>
          <Flexbox horizontal>
            <Input
              placeholder={'Snapshot title (optional)'}
              value={snapshotTitle}
              onChange={(event) => setSnapshotTitle(event.target.value)}
              onPressEnter={saveSnapshot}
            />
            <Button onClick={saveSnapshot}>Save</Button>
          </Flexbox>

          {snapshots.length === 0 ? (
            <Empty description={'No snapshots yet'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Flexbox gap={8}>
              {snapshots.map((snapshot) => (
                <Flexbox className={styles.chatBubble} key={snapshot.id}>
                  <Flexbox horizontal justify={'space-between'}>
                    <strong>{snapshot.title}</strong>
                    <span className={styles.hint}>v{snapshot.version}</span>
                  </Flexbox>
                  <span className={styles.hint}>
                    {dayjs(snapshot.createdAt).format('YYYY-MM-DD HH:mm')}
                  </span>
                </Flexbox>
              ))}
            </Flexbox>
          )}

          <span className={styles.sectionTitle}>Preview / Deploy URLs</span>
          <Flexbox horizontal>
            <Input
              placeholder={'https://preview.example.app'}
              value={previewUrl}
              onChange={(event) => setPreviewUrl(event.target.value)}
              onPressEnter={addPreviewDeployment}
            />
            <Button onClick={addPreviewDeployment}>Add</Button>
          </Flexbox>

          {deployments.length === 0 ? (
            <Empty description={'No deployment URLs yet'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Flexbox gap={8}>
              {deployments.map((deployment) => (
                <Flexbox className={styles.chatBubble} key={deployment.id}>
                  <Flexbox horizontal justify={'space-between'}>
                    <strong>{deployment.deploymentType}</strong>
                    <span className={styles.hint}>{deployment.status}</span>
                  </Flexbox>
                  <a href={deployment.url} rel={'noreferrer'} target={'_blank'}>
                    {deployment.url}
                  </a>
                </Flexbox>
              ))}
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
};

export default StudioPage;
