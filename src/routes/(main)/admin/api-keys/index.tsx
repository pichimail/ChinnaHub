'use client';

import { Button, Form, Input, message, Modal, Space, Spin, Switch, Table } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const AdminApiKeysPage = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useSWR('admin:api-keys', async () => {
    const result = await lambdaClient.admin.getAdminApiKeys.query();
    return result.data || [];
  });

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await lambdaClient.admin.upsertAdminApiKey.mutate({
        config: values.config ? JSON.parse(values.config) : {},
        isActive: values.isActive,
        keyValue: values.keyValue,
        label: values.label,
        service: values.service,
      });
      message.success('Saved');
      setOpen(false);
      form.resetFields();
      mutate('admin:api-keys');
    } catch {
      message.error('Save failed');
    }
  };

  const remove = async (id: string) => {
    try {
      await lambdaClient.admin.deleteAdminApiKey.mutate({ id });
      message.success('Deleted');
      mutate('admin:api-keys');
    } catch {
      message.error('Delete failed');
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          {t('apiKeys', { ns: 'admin' })}
        </Button>
      </div>

      <Table
        dataSource={data || []}
        rowKey="id"
        columns={[
          { dataIndex: 'service', key: 'service', title: 'Service' },
          { dataIndex: 'label', key: 'label', title: t('label', { ns: 'admin' }) },
          {
            dataIndex: 'isActive',
            key: 'isActive',
            title: 'Active',
            render: (v: boolean) => (v ? t('yes', { ns: 'admin' }) : t('no', { ns: 'admin' })),
          },
          {
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            title: 'Updated',
            render: (d: string) => (d ? new Date(d).toLocaleString() : '-'),
          },
          {
            key: 'actions',
            title: t('actions', { ns: 'admin' }),
            render: (_: unknown, record: any) => (
              <Space>
                <Button danger size="small" onClick={() => remove(record.id)}>
                  {t('delete', { ns: 'admin' })}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title={t('apiKeys', { ns: 'admin' })}
        onCancel={() => setOpen(false)}
        onOk={submit}
      >
        <Form form={form} initialValues={{ isActive: true }} layout="vertical">
          <Form.Item label="Service" name="service" rules={[{ required: true }]}>
            <Input placeholder="audio_generation" />
          </Form.Item>
          <Form.Item label={t('label', { ns: 'admin' })} name="label" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Key" name="keyValue" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Config JSON" name="config">
            <Input.TextArea placeholder='{"endpoint":"..."}' rows={4} />
          </Form.Item>
          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminApiKeysPage;
