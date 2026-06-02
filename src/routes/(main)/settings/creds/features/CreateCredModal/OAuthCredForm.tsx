'use client';

import { Button, Flexbox } from '@lobehub/ui';
import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Avatar, Empty, Form, Input, Select, Spin } from 'antd';
import { createStaticStyles } from 'antd-style';
import { LogIn } from 'lucide-react';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import { useMarketAuth } from '@/layout/AuthProvider/MarketAuth';
import { lambdaClient, lambdaQuery } from '@/libs/trpc/client';

const styles = createStaticStyles(({ css, cssVar }) => ({
  connectionOption: css`
    display: flex;
    gap: 8px;
    align-items: center;
  `,
  footer: css`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-block-start: 24px;
  `,
  provider: css`
    font-weight: 500;
  `,
  username: css`
    color: ${cssVar.colorTextSecondary};
  `,
}));

interface OAuthCredFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

interface FormValues {
  description?: string;
  key: string;
  name: string;
  oauthConnectionId: number;
}

const OAuthCredForm: FC<OAuthCredFormProps> = ({ onBack, onSuccess }) => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm<FormValues>();
  const { isAuthenticated, isLoading: isAuthLoading, signIn } = useMarketAuth();

  const {
    data: connectionsData,
    error,
    isLoading,
    refetch,
  } = lambdaQuery.market.creds.listOAuthConnections.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const connections = connectionsData?.connections ?? [];
  const isUnauthorizedError =
    error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED';

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => {
      return lambdaClient.market.creds.createOAuth.mutate({
        description: values.description,
        key: values.key,
        name: values.name,
        oauthConnectionId: values.oauthConnectionId,
      });
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSignIn = async () => {
    try {
      await signIn();
      await refetch();
    } catch (signInError) {
      console.error('[OAuthCredForm] Market sign-in failed:', signInError);
    }
  };

  const handleSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  if (isAuthLoading || (isLoading && !error)) {
    return (
      <Flexbox align="center" justify="center" style={{ padding: 48 }}>
        <Spin />
      </Flexbox>
    );
  }

  if (!isAuthenticated || isUnauthorizedError) {
    return (
      <Flexbox align="center" gap={16} justify="center" style={{ padding: 48 }}>
        <Empty description={t('creds.signInRequired')} />
        <div className={styles.footer}>
          <Button icon={LogIn} type="primary" onClick={handleSignIn}>
            {t('creds.signIn')}
          </Button>
          <Button onClick={onBack}>{t('creds.form.back')}</Button>
        </div>
      </Flexbox>
    );
  }

  if (error && !isUnauthorizedError) {
    return (
      <Flexbox align="center" gap={16} justify="center" style={{ padding: 48 }}>
        <Empty description={error.message || t('creds.signInRequired')} />
        <div className={styles.footer}>
          <Button icon={LogIn} type="primary" onClick={handleSignIn}>
            {t('creds.signIn')}
          </Button>
          <Button onClick={onBack}>{t('creds.form.back')}</Button>
        </div>
      </Flexbox>
    );
  }

  if (connections.length === 0) {
    return (
      <Flexbox gap={16}>
        <Empty description={t('creds.oauth.noConnections')} />
        <div className={styles.footer}>
          <Button onClick={onBack}>{t('creds.form.back')}</Button>
        </div>
      </Flexbox>
    );
  }

  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        label={t('creds.form.selectConnection')}
        name="oauthConnectionId"
        rules={[{ required: true, message: t('creds.form.connectionRequired') }]}
      >
        <Select placeholder={t('creds.form.selectConnectionPlaceholder')}>
          {connections.map((conn: any) => {
            const provider = conn.providerId || 'OAuth';
            const displayName =
              conn.providerName || conn.providerUserName || conn.email || conn.name;
            return (
              <Select.Option key={conn.id} value={conn.id}>
                <span className={styles.connectionOption}>
                  {conn.avatar && <Avatar size="small" src={conn.avatar} />}
                  <span>
                    <span className={styles.provider}>{provider}</span>
                    {displayName && <span className={styles.username}> - {displayName}</span>}
                  </span>
                </span>
              </Select.Option>
            );
          })}
        </Select>
      </Form.Item>

      <Form.Item
        label={t('creds.form.key')}
        name="key"
        rules={[
          { required: true, message: t('creds.form.keyRequired') },
          { pattern: /^[\w-]+$/, message: t('creds.form.keyPattern') },
        ]}
      >
        <Input placeholder="e.g., github-oauth" />
      </Form.Item>

      <Form.Item
        label={t('creds.form.name')}
        name="name"
        rules={[{ required: true, message: t('creds.form.nameRequired') }]}
      >
        <Input placeholder="e.g., GitHub Connection" />
      </Form.Item>

      <Form.Item label={t('creds.form.description')} name="description">
        <Input.TextArea placeholder={t('creds.form.descriptionPlaceholder')} rows={2} />
      </Form.Item>

      <div className={styles.footer}>
        <Button onClick={onBack}>{t('creds.form.back')}</Button>
        <Button htmlType="submit" loading={createMutation.isPending} type="primary">
          {t('creds.form.submit')}
        </Button>
      </div>
    </Form>
  );
};

export default OAuthCredForm;
