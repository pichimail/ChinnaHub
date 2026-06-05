import type { AiModelForSelect } from 'model-bank';

import GenerationModelItem from '@/routes/(main)/(create)/components/GenerationModelItem';

type AudioModelItemProps = AiModelForSelect & {
  providerId?: string;
  showBadge?: boolean;
  showPopover?: boolean;
};

const AudioModelItem = (props: AudioModelItemProps) => (
  <GenerationModelItem {...props} priceKind="audio" showPrice={false} />
);

export default AudioModelItem;
