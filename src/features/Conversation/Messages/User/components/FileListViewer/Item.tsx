import { Block, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';

import FileIcon from '@/components/FileIcon';
import MediaFilePreview from '@/components/MediaFilePreview';
import { useChatStore } from '@/store/chat';
import { type ChatFileItem } from '@/types/index';
import { formatSize } from '@/utils/format';
import { getMediaKind } from '@/utils/mediaFile';

const FileItem = memo<ChatFileItem>(({ id, fileType, size, name, url }) => {
  const openFilePreview = useChatStore((s) => s.openFilePreview);
  const mediaKind = getMediaKind(fileType, name);

  if (mediaKind && url) {
    return <MediaFilePreview fileType={fileType} name={name} url={url} />;
  }

  return (
    <Block
      clickable
      horizontal
      align={'center'}
      gap={12}
      key={id}
      paddingBlock={8}
      paddingInline={'12px 16px'}
      variant={'outlined'}
      onClick={() => {
        openFilePreview({ fileId: id });
      }}
    >
      <FileIcon fileName={name} fileType={fileType} size={32} />
      <Flexbox style={{ overflow: 'hidden' }}>
        <Text ellipsis>{name}</Text>
        <Text fontSize={12} type={'secondary'}>
          {formatSize(size)}
        </Text>
      </Flexbox>
    </Block>
  );
});
export default FileItem;
