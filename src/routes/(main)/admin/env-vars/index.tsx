'use client';

import {
  Alert,
  Button,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

type EnvVarRow = {
  domain: string;
  id: string;
  isActive: boolean;
  isSecret: boolean;
  key: string;
  value: string;
};

type RuntimeCatalogRow = {
  adminValueMasked?: string;
  description: string;
  domain: string;
  hasAdminValue: boolean;
  hasProcessValue: boolean;
  isSecret: boolean;
  issues: string[];
  key: string;
  processValueMasked?: string;
  requiredFor: string[];
  source: 'admin' | 'missing' | 'process';
};

const sourceColor: Record<RuntimeCatalogRow['source'], string> = {
  admin: 'green',
  missing: 'red',
  process: 'blue',
};

const AdminEnvVarsPage = () => {
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const openQuickAdd = (record: RuntimeCatalogRow) => {
    form.setFieldsValue({
      description: record.description,
      domain: record.domain,
      isActive: true,
      isSecret: record.isSecret,
      key: record.key,
      value: '',
    });
    setOpen(true);
  };

  const { data, isLoading } = useSWR('admin:env-vars', async () => {
    const result = await lambdaClient.admin.getEnvVars.query();
    return result.data || [];
  });

  const { data: catalog, isLoading: isCatalogLoading } = useSWR('admin:env-catalog', async () => {
    const result = await lambdaClient.admin.getRuntimeEnvCatalog.query();
    return (result.data || []) as RuntimeCatalogRow[];
  });

  const importRuntime = async () => {
    try {
      const result = await lambdaClient.admin.importRuntimeEnvVars.mutate();
      message.success(
        `Imported ${result.data.imported} runtime variables. Skipped ${result.data.skipped}.`,
      );
      mutate('admin:env-vars');
      mutate('admin:env-catalog');
    } catch {
      message.error('Import failed');
    }
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      await lambdaClient.admin.upsertEnvVar.mutate(values);
      message.success('Env var saved — environment updated');
      setOpen(false);
      form.resetFields();
      mutate('admin:env-vars');
      mutate('admin:env-catalog');
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

  if (isLoading || isCatalogLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setOpen(true)}>
          Add Environment Variable
        </Button>
        <Button onClick={importRuntime}>Import Existing Runtime Values</Button>
      </Space>

      <Tabs
        items={[
          {
            key: 'catalog',
            label: 'Required Runtime Variables',
            children: (
              <Table
                dataSource={catalog || []}
                rowKey={(row) => `${row.domain}:${row.key}`}
                columns={[
                  { dataIndex: 'domain', key: 'domain', title: 'Domain' },
                  { dataIndex: 'key', key: 'key', title: 'Key' },
                  {
                    dataIndex: 'source',
                    key: 'source',
                    title: 'Source',
                    render: (source: RuntimeCatalogRow['source']) => (
                      <Tag color={sourceColor[source]}>{source.toUpperCase()}</Tag>
                    ),
                  },
                  {
                    key: 'values',
                    title: 'Values',
                    render: (_: unknown, record: RuntimeCatalogRow) =>
                      `Admin ${record.adminValueMasked || '-'} / Runtime ${
                        record.processValueMasked || '-'
                      }`,
                  },
                  {
                    dataIndex: 'requiredFor',
                    key: 'requiredFor',
                    title: 'Used For',
                    render: (items: string[]) => items.map((item) => <Tag key={item}>{item}</Tag>),
                  },
                  {
                    dataIndex: 'issues',
                    key: 'issues',
                    title: 'Status',
                    render: (issues: string[]) =>
                      issues.length > 0 ? (
                        <Alert showIcon message={issues.join(' ')} type="warning" />
                      ) : (
                        <Tag color="green">Ready</Tag>
                      ),
                  },
                  { dataIndex: 'description', key: 'description', title: 'Description' },
                  {
                    key: 'actions',
                    title: 'Actions',
                    render: (_: unknown, record: RuntimeCatalogRow) =>
                      record.source === 'missing' ? (
                        <Button size="small" type="primary" onClick={() => openQuickAdd(record)}>
                          Set Value
                        </Button>
                      ) : (
                        <Button size="small" onClick={() => openQuickAdd(record)}>
                          Edit
                        </Button>
                      ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'saved',
            label: 'Saved Variables',
            children: (
              <Table
                dataSource={(data || []) as EnvVarRow[]}
                rowKey="id"
                columns={[
                  { dataIndex: 'domain', key: 'domain', title: 'Domain' },
                  { dataIndex: 'key', key: 'key', title: 'Key' },
                  {
                    dataIndex: 'value',
                    key: 'value',
                    title: 'Value',
                    render: (value: string, record: EnvVarRow) =>
                      record.isSecret ? '********' : value,
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
                    render: (_: unknown, record: EnvVarRow) => (
                      <Space>
                        <Button danger size="small" onClick={() => remove(record.id)}>
                          Delete
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        open={open}
        title="Environment Variable"
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        onOk={submit}
      >
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
