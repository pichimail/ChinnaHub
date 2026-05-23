'use client';

import { Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { FileTextIcon } from 'lucide-react';
import { memo } from 'react';

const useStyles = createStaticStyles(({ css, cssVar }) => ({
  empty: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;

    min-height: 240px;
    margin-block-start: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;

    color: ${cssVar.colorTextQuaternary};

    background: ${cssVar.colorBgContainer};
  `,
}));

const AdminContent = memo(() => {
  const { styles } = useStyles();

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>Content Management</div>
      <div className={styles.empty}>
        <FileTextIcon size={40} strokeWidth={1} />
        <Text type="secondary">Content management coming soon</Text>
      </div>
    </div>
  );
});

AdminContent.displayName = 'AdminContent';

export default AdminContent;
