import { Center } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { BotMessageSquare } from 'lucide-react';

export const OPENROUTER_AUTO_MODEL_ID = 'openrouter/auto';
export const CHINNA_AUTO_MODEL_LABEL = 'chinna-ai/auto';

export const getModelDisplayName = (modelId: string, displayName?: string) =>
  modelId === OPENROUTER_AUTO_MODEL_ID ? CHINNA_AUTO_MODEL_LABEL : displayName || modelId;

const styles = createStaticStyles(({ css, cssVar }) => ({
  icon: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 50%;
    color: ${cssVar.colorPrimary};
    background: linear-gradient(135deg, ${cssVar.colorPrimaryBg}, ${cssVar.colorInfoBg});
  `,
}));

export const ChinnaAutoModelIcon = ({ size = 20 }: { size?: number }) => (
  <Center className={styles.icon} height={size} width={size}>
    <BotMessageSquare size={Math.round(size * 0.68)} strokeWidth={2.2} />
  </Center>
);
