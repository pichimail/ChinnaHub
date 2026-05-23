'use client';

import { Button, Form, Input, message, Modal, Space, Spin, Switch, Table } from 'antd';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const AdminEnvVarsPage = () => {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useSWR('admin:env-vars', async () => {
    const result = await lambdaClient.admin.getEnvVars.query();
    return result.data || [];
  });

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await lambdaClient.admin.upsertEnvVar.mutate(values);
      message.success('Env var saved');
      setOpen(false);
      form.resetFields();
      mutate('admin:env-vars');
    } catch {
      message.error('Save failed');
    }
  };

  const remove = async (id: string) => {
    try {
      await lambdaClient.admin.deleteEnvVar.mutate({ id });
      message.success('Deleted');
      mutate('admin:env-vars');
    } catch {
      message.error('Delete failed');
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Add Environment Variable
        </Button>
      </div>

      <Table
        dataSource={data || []}
        rowKey="id"
        columns={[
          { dataIndex: 'domain', key: 'domain', title: 'Domain' },
          { dataIndex: 'key', key: 'key', title: 'Key' },
          {
            dataIndex: 'value',
            key: 'value',
            title: 'Value',
            render: (value: string, record: any) => (record.isSecret ? '********' : value),
          },
          {
            dataIndex: 'isActive',
            key: 'isActive',
            title: 'Active',
            render: (v: boolean) => (v ? 'Yes' : 'No'),
          },
          {
            key: 'actions',
            title: 'Actions',
            render: (_: unknown, record: any) => (
              <Space>
                <Button danger size="small" onClick={() => remove(record.id)}>
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal open={open} title="Environment Variable" onCancel={() => setOpen(false)} onOk={submit}>
        <Form
          form={form}
          initialValues={{ domain: 'global', isActive: true, isSecret: true }}
          layout="vertical"
        >
          <Form.Item label="Domain" name="domain" rules={[{ required: true }]}>
            <Input placeholder="global | ai | marketplace" />
          </Form.Item>
          <Form.Item label="Key" name="key" rules={[{ required: true }]}>
            <Input placeholder="OPENAI_API_KEY" />
          </Form.Item>
          <Form.Item label="Value" name="value" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Secret" name="isSecret" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminEnvVarsPage;
