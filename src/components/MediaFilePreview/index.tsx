'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { DownloadIcon, ExternalLinkIcon, Music2Icon, VideoIcon } from 'lucide-react';
import { memo, useState } from 'react';

import { downloadFile } from '@/utils/client/downloadFile';
import { getMediaKind } from '@/utils/mediaFile';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    flex: none;
  `,
  container: css`
    overflow: hidden;
    max-width: 100%;
    border-radius: ${cssVar.borderRadiusLG};
  `,
  media: css`
    width: 100%;
    max-width: 100%;
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgLayout};
  `,
  video: css`
    max-height: 420px;
    object-fit: contain;
  `,
}));

interface MediaFilePreviewProps {
  fileType?: string | null;
  name?: string | null;
  size?: 'compact' | 'full';
  url?: string | null;
}

const MediaFilePreview = memo<MediaFilePreviewProps>(
  ({ fileType, name = 'media file', size = 'compact', url }) => {
    const [hasPlaybackError, setHasPlaybackError] = useState(false);
    const mediaKind = getMediaKind(fileType, name);

    if (!url || !mediaKind) return null;

    const icon = mediaKind === 'audio' ? <Music2Icon size={18} /> : <VideoIcon size={18} />;
    const title = name || (mediaKind === 'audio' ? 'Audio file' : 'Video file');

    return (
      <Block className={styles.container} gap={10} padding={12} variant={'outlined'}>
        <Flexbox horizontal align={'center'} gap={8}>
          {icon}
          <Text ellipsis>{title}</Text>
        </Flexbox>
        {mediaKind === 'audio' ? (
          <audio
            controls
            className={styles.media}
            preload="metadata"
            src={url}
            onError={() => setHasPlaybackError(true)}
          />
        ) : (
          <video
            controls
            playsInline
            className={`${styles.media} ${styles.video}`}
            preload="metadata"
            src={url}
            style={{ maxHeight: size === 'full' ? '70vh' : 420 }}
            onError={() => setHasPlaybackError(true)}
          />
        )}
        {hasPlaybackError && (
          <Text fontSize={12} type={'secondary'}>
            Preview is not supported by this browser. You can still open or download the file.
          </Text>
        )}
        <Flexbox horizontal className={styles.actions} gap={8}>
          <Button
            icon={ExternalLinkIcon}
            size={'small'}
            onClick={() => {
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            Open
          </Button>
          <Button
            icon={DownloadIcon}
            size={'small'}
            onClick={async () => {
              await downloadFile(url, title);
            }}
          >
            Download
          </Button>
        </Flexbox>
      </Block>
    );
  },
);

MediaFilePreview.displayName = 'MediaFilePreview';

export default MediaFilePreview;
