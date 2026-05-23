'use client';

import { Button, Form, Input, message, Modal, Space, Spin, Switch, Table } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const AdminFeatureFlags = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm();
  const [isCreating, setIsCreating] = useState(false);

  const { data: flagsData, isLoading } = useSWR(
    'admin:feature-flags',
    async () => {
      const result = await lambdaClient.admin.getFeatureFlags.query();
      return result.data || [];
    },
    { revalidateOnFocus: false },
  );

  const handleCreateFlag = async (values: any) => {
    try {
      await lambdaClient.admin.createFeatureFlag.mutate(values);
      message.success(t('flagCreated', { ns: 'admin' }));
      form.resetFields();
      setIsCreating(false);
      mutate('admin:feature-flags');
    } catch {
      message.error(t('createFailed', { ns: 'admin' }));
    }
  };

  const handleDeleteFlag = async (flagId: string) => {
    try {
      await lambdaClient.admin.deleteFeatureFlag.mutate({ flagId });
      message.success(t('flagDeleted', { ns: 'admin' }));
      mutate('admin:feature-flags');
    } catch {
      message.error(t('deleteFailed', { ns: 'admin' }));
    }
  };

  if (isLoading) {
    return <Spin size="large" style={{ marginTop: '48px' }} />;
  }

  const columns = [
    {
      dataIndex: 'key',
      key: 'key',
      title: t('flagKey', { ns: 'admin' }),
    },
    {
      dataIndex: 'label',
      key: 'label',
      title: t('label', { ns: 'admin' }),
    },
    {
      dataIndex: 'defaultEnabled',
      key: 'defaultEnabled',
      render: (enabled: boolean) =>
        enabled ? t('yes', { ns: 'admin' }) : t('no', { ns: 'admin' }),
      title: t('defaultEnabled', { ns: 'admin' }),
    },
    {
      key: 'actions',
      render: (_: unknown, record: any) => (
        <Space>
          <Button size="small" type="link">
            {t('edit', { ns: 'admin' })}
          </Button>
          <Button danger size="small" type="link" onClick={() => handleDeleteFlag(record.id)}>
            {t('delete', { ns: 'admin' })}
          </Button>
        </Space>
      ),
      title: t('actions', { ns: 'admin' }),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Button type="primary" onClick={() => setIsCreating(true)}>
          {t('createFlag', { ns: 'admin' })}
        </Button>
      </div>

      <Table columns={columns} dataSource={flagsData || []} rowKey="id" />

      <Modal
        open={isCreating}
        title={t('createFlag', { ns: 'admin' })}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsCreating(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateFlag}>
          <Form.Item label={t('flagKey', { ns: 'admin' })} name="key" rules={[{ required: true }]}>
            <Input placeholder="enable_feature_x" />
          </Form.Item>

          <Form.Item label={t('label', { ns: 'admin' })} name="label" rules={[{ required: true }]}>
            <Input placeholder="Feature X" />
          </Form.Item>

          <Form.Item label={t('description', { ns: 'admin' })} name="description">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item
            label={t('defaultEnabled', { ns: 'admin' })}
            name="defaultEnabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminFeatureFlags;
