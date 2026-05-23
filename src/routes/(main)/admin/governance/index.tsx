'use client';

import { Button, Form, Input, message, Modal, Select, Space, Spin, Switch, Table } from 'antd';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const domainOptions = ['content', 'pricing', 'marketplace', 'image', 'video', 'audio'];
const modeOptions = ['allow', 'deny', 'review', 'throttle'];

const AdminGovernancePage = () => {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useSWR('admin:governance', async () => {
    const result = await lambdaClient.admin.getGovernancePolicies.query();
    return result.data || [];
  });

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await lambdaClient.admin.upsertGovernancePolicy.mutate({
        ...values,
        config: values.config ? JSON.parse(values.config) : {},
      });
      message.success('Policy saved');
      setOpen(false);
      form.resetFields();
      mutate('admin:governance');
    } catch {
      message.error('Save failed');
    }
  };

  const remove = async (id: string) => {
    try {
      await lambdaClient.admin.deleteGovernancePolicy.mutate({ id });
      message.success('Deleted');
      mutate('admin:governance');
    } catch {
      message.error('Delete failed');
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Add Governance Policy
        </Button>
      </div>

      <Table
        dataSource={data || []}
        rowKey="id"
        columns={[
          { dataIndex: 'domain', key: 'domain', title: 'Domain' },
          { dataIndex: 'target', key: 'target', title: 'Target' },
          { dataIndex: 'mode', key: 'mode', title: 'Mode' },
          { dataIndex: 'priority', key: 'priority', title: 'Priority' },
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

      <Modal open={open} title="Governance Policy" onCancel={() => setOpen(false)} onOk={submit}>
        <Form
          form={form}
          initialValues={{ domain: 'content', isActive: true, mode: 'allow', priority: 100 }}
          layout="vertical"
        >
          <Form.Item label="Domain" name="domain" rules={[{ required: true }]}>
            <Select options={domainOptions.map((d) => ({ label: d, value: d }))} />
          </Form.Item>
          <Form.Item label="Target" name="target" rules={[{ required: true }]}>
            <Input placeholder="model:gpt-4.1 | plan:free | media:image" />
          </Form.Item>
          <Form.Item label="Mode" name="mode" rules={[{ required: true }]}>
            <Select options={modeOptions.map((m) => ({ label: m, value: m }))} />
          </Form.Item>
          <Form.Item label="Priority" name="priority" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label="Config JSON" name="config">
            <Input.TextArea placeholder='{"maxPerMinute":30}' rows={4} />
          </Form.Item>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Active" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminGovernancePage;
