'use client';

import { Button, Form, Input, message, Modal, Select, Space, Spin, Switch, Table } from 'antd';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';

const AdminFeatureFlags = () => {
  const { mutate } = useSWRConfig();
  const [form] = Form.useForm();
  const [overrideForm] = Form.useForm();
  const [isCreating, setIsCreating] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const { data: flagsData, isLoading } = useSWR('admin:feature-flags', async () => {
    const result = await lambdaClient.admin.getFeatureFlags.query();
    return result.data || [];
  });

  const { data: usersData } = useSWR('admin:feature-flags:users', async () => {
    const result = await lambdaClient.admin.getUsers.query({ limit: 500, offset: 0 });
    return result.data?.users || [];
  });

  const handleCreateFlag = async (values: any) => {
    try {
      await lambdaClient.admin.createFeatureFlag.mutate(values);
      message.success('Feature flag created');
      form.resetFields();
      setIsCreating(false);
      mutate('admin:feature-flags');
    } catch {
      message.error('Create failed');
    }
  };

  const handleUpdateFlag = async (record: any, defaultEnabled: boolean) => {
    try {
      await lambdaClient.admin.updateFeatureFlag.mutate({
        defaultEnabled,
        flagId: record.id,
      });
      mutate('admin:feature-flags');
      message.success('Flag updated');
    } catch {
      message.error('Update failed');
    }
  };

  const handleDeleteFlag = async (flagId: string) => {
    try {
      await lambdaClient.admin.deleteFeatureFlag.mutate({ flagId });
      message.success('Flag deleted');
      mutate('admin:feature-flags');
    } catch {
      message.error('Delete failed');
    }
  };

  const handleOverride = async () => {
    try {
      const values = await overrideForm.validateFields();
      await lambdaClient.admin.setUserFeatureFlag.mutate(values);
      message.success('User override saved');
      overrideForm.resetFields();
      setOverrideOpen(false);
    } catch {
      message.error('Failed to save override');
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: '48px' }} />;

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Space>
          <Button type="primary" onClick={() => setIsCreating(true)}>
            <AdminLabel icon={adminIcons.featureFlags}>Create Flag</AdminLabel>
          </Button>
          <Button onClick={() => setOverrideOpen(true)}>
            <AdminLabel icon={adminIcons.featureOverrides}>Per-user Override</AdminLabel>
          </Button>
        </Space>
      </div>

      <Table
        dataSource={flagsData || []}
        rowKey="id"
        columns={[
          {
            dataIndex: 'key',
            key: 'key',
            title: <AdminLabel icon={adminIcons.key}>Flag Key</AdminLabel>,
          },
          {
            dataIndex: 'label',
            key: 'label',
            title: <AdminLabel icon={adminIcons.email}>Label</AdminLabel>,
          },
          {
            dataIndex: 'description',
            key: 'description',
            title: <AdminLabel icon={adminIcons.description}>Description</AdminLabel>,
          },
          {
            dataIndex: 'defaultEnabled',
            key: 'defaultEnabled',
            title: <AdminLabel icon={adminIcons.featureFlags}>Default Enabled</AdminLabel>,
            render: (enabled: boolean, record: any) => (
              <Switch checked={enabled} onChange={(next) => handleUpdateFlag(record, next)} />
            ),
          },
          {
            key: 'actions',
            title: <AdminLabel icon={adminIcons.actions}>Actions</AdminLabel>,
            render: (_: unknown, record: any) => (
              <Button danger size="small" type="link" onClick={() => handleDeleteFlag(record.id)}>
                <AdminLabel icon={adminIcons.actions}>Delete</AdminLabel>
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={isCreating}
        title={<AdminLabel icon={adminIcons.featureFlags}>Create Flag</AdminLabel>}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsCreating(false);
          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateFlag}>
          <Form.Item label="Flag Key" name="key" rules={[{ required: true }]}>
            <Input placeholder="enable_feature_x" />
          </Form.Item>
          <Form.Item label="Label" name="label" rules={[{ required: true }]}>
            <Input placeholder="Feature X" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Default Enabled" name="defaultEnabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={overrideOpen}
        title={
          <AdminLabel icon={adminIcons.featureOverrides}>Per-user Flag Override</AdminLabel>
        }
        onCancel={() => setOverrideOpen(false)}
        onOk={handleOverride}
      >
        <Form form={overrideForm} initialValues={{ enabled: true }} layout="vertical">
          <Form.Item label="User" name="userId" rules={[{ required: true }]}>
            <Select
              showSearch
              options={(usersData || []).map((u: any) => ({
                label: `${u.email || u.id} (${u.id.slice(0, 8)})`,
                value: u.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="Feature" name="flagKey" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select a feature flag"
              options={(flagsData || []).map((f: any) => ({
                label: `${f.label || f.key} (${f.key})`,
                value: f.key,
              }))}
            />
          </Form.Item>
          <Form.Item label="Enabled" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminFeatureFlags;
