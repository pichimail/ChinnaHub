'use client';

import { Button, Form, Input, message, Modal, Select, Space, Spin, Switch, Table, Tag } from 'antd';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';

const domainOptions = ['content', 'pricing', 'marketplace', 'image', 'video', 'audio', 'provider'];
const modeOptions = ['allow', 'deny', 'review', 'throttle'];

const modeColor: Record<string, string> = {
  allow: 'green',
  deny: 'red',
  review: 'orange',
  throttle: 'blue',
};

type PolicyRow = {
  config?: Record<string, unknown>;
  domain: string;
  id: string;
  isActive: boolean;
  mode: string;
  notes?: string | null;
  priority: number;
  target: string;
};

const AdminGovernancePage = () => {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [form] = Form.useForm();

  const { data, isLoading } = useSWR('admin:governance', async () => {
    const result = await lambdaClient.admin.getGovernancePolicies.query();
    return (result.data || []) as PolicyRow[];
  });

  const openAdd = () => {
    setEditingId(undefined);
    form.resetFields();
    form.setFieldsValue({ domain: 'content', isActive: true, mode: 'allow', priority: 100 });
    setOpen(true);
  };

  const openEdit = (record: PolicyRow) => {
    setEditingId(record.id);
    form.setFieldsValue({
      config: record.config ? JSON.stringify(record.config, null, 2) : '',
      domain: record.domain,
      isActive: record.isActive,
      mode: record.mode,
      notes: record.notes,
      priority: record.priority,
      target: record.target,
    });
    setOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await lambdaClient.admin.upsertGovernancePolicy.mutate({
        ...values,
        config: values.config ? JSON.parse(values.config) : {},
        id: editingId,
      });
      message.success(editingId ? 'Policy updated' : 'Policy created');
      setOpen(false);
      form.resetFields();
      setEditingId(undefined);
      mutate('admin:governance');
    } catch {
      message.error('Save failed — check JSON config syntax');
    }
  };

  const remove = async (id: string) => {
    try {
      await lambdaClient.admin.deleteGovernancePolicy.mutate({ id });
      message.success('Policy deleted');
      mutate('admin:governance');
    } catch {
      message.error('Delete failed');
    }
  };

  const toggleActive = async (record: PolicyRow) => {
    try {
      await lambdaClient.admin.upsertGovernancePolicy.mutate({
        config: record.config || {},
        domain: record.domain as any,
        id: record.id,
        isActive: !record.isActive,
        mode: record.mode as any,
        notes: record.notes ?? undefined,
        priority: record.priority,
        target: record.target,
      });
      message.success(`Policy ${!record.isActive ? 'activated' : 'deactivated'}`);
      mutate('admin:governance');
    } catch {
      message.error('Toggle failed');
    }
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <Space direction="vertical" size={12} style={{}}>
        <Button type="primary" onClick={openAdd}>
          <AdminLabel icon={adminIcons.governance}>Add Governance Policy</AdminLabel>
        </Button>
      </Space>

      <Table
        dataSource={data || []}
        rowKey="id"
        columns={[
          {
            dataIndex: 'domain',
            key: 'domain',
            title: <AdminLabel icon={adminIcons.domain}>Domain</AdminLabel>,
            render: (d: string) => <Tag color="purple">{d}</Tag>,
          },
          {
            dataIndex: 'target',
            key: 'target',
            title: <AdminLabel icon={adminIcons.target}>Target</AdminLabel>,
          },
          {
            dataIndex: 'mode',
            key: 'mode',
            title: <AdminLabel icon={adminIcons.featureFlags}>Mode</AdminLabel>,
            render: (m: string) => <Tag color={modeColor[m] ?? 'default'}>{m.toUpperCase()}</Tag>,
          },
          {
            dataIndex: 'priority',
            key: 'priority',
            title: <AdminLabel icon={adminIcons.updated}>Priority</AdminLabel>,
          },
          {
            dataIndex: 'isActive',
            key: 'isActive',
            title: <AdminLabel icon={adminIcons.featureFlags}>Active</AdminLabel>,
            render: (v: boolean, record: PolicyRow) => (
              <Switch checked={v} size="small" onChange={() => toggleActive(record)} />
            ),
          },
          {
            dataIndex: 'notes',
            key: 'notes',
            title: <AdminLabel icon={adminIcons.description}>Notes</AdminLabel>,
            render: (n: string | null) => n || '—',
          },
          {
            key: 'actions',
            title: <AdminLabel icon={adminIcons.actions}>Actions</AdminLabel>,
            render: (_: unknown, record: PolicyRow) => (
              <Space>
                <Button size="small" onClick={() => openEdit(record)}>
                  Edit
                </Button>
                <Button danger size="small" onClick={() => remove(record.id)}>
                  Delete
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title={
          <AdminLabel icon={adminIcons.governance}>
            {editingId ? 'Edit Governance Policy' : 'Add Governance Policy'}
          </AdminLabel>
        }
        onOk={submit}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
          setEditingId(undefined);
        }}
      >
        <Form
          form={form}
          initialValues={{ domain: 'content', isActive: true, mode: 'allow', priority: 100 }}
          layout="vertical"
        >
          <Form.Item label={<AdminLabel icon={adminIcons.domain}>Domain</AdminLabel>} name="domain" rules={[{ required: true }]}>
            <Select options={domainOptions.map((d) => ({ label: d, value: d }))} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.target}>Target</AdminLabel>} name="target" rules={[{ required: true }]}>
            <Input placeholder="model:gpt-4.1 | plan:free | openai | *" />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.featureFlags}>Mode</AdminLabel>} name="mode" rules={[{ required: true }]}>
            <Select options={modeOptions.map((m) => ({ label: m, value: m }))} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.updated}>Priority</AdminLabel>} name="priority" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.description}>Config JSON</AdminLabel>} name="config">
            <Input.TextArea placeholder='{"maxPerMinute":30}' rows={4} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.description}>Notes</AdminLabel>} name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.featureFlags}>Active</AdminLabel>} name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminGovernancePage;
