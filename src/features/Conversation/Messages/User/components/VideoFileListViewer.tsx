import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import MediaFilePreview from '@/components/MediaFilePreview';
import { type ChatVideoItem } from '@/types/index';

interface VideoFileListViewerProps {
  items: ChatVideoItem[];
}

const VideoFileListViewer = memo<VideoFileListViewerProps>(({ items }) => {
  return (
    <Flexbox gap={8}>
      {items.map((item) => (
        <MediaFilePreview
          fileType={'video/mp4'}
          key={item.id}
          name={item.alt || 'Video file'}
          url={item.url}
        />
      ))}
    </Flexbox>
  );
});

export default VideoFileListViewer;
