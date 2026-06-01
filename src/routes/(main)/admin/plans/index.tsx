'use client';

import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
} from 'antd';
import { useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';
import AdminLabel, { adminIcons } from '@/routes/(main)/admin/components/AdminLabel';

const AdminPlansPage = () => {
  const { mutate } = useSWRConfig();
  const [planForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [planOpen, setPlanOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data, isLoading } = useSWR('admin:plans', async () => {
    const result = await lambdaClient.admin.getPlans.query();
    return result.data || { planFeatures: [], plans: [], userPlans: [] };
  });

  const { data: usersData } = useSWR('admin:plans:users', async () => {
    const result = await lambdaClient.admin.getUsers.query({ limit: 500, offset: 0 });
    return result.data?.users || [];
  });

  const { data: flagsData } = useSWR('admin:plans:flags', async () => {
    const result = await lambdaClient.admin.getFeatureFlags.query();
    return result.data || [];
  });

  const planOptions = useMemo(
    () => (data?.plans || []).map((plan: any) => ({ label: plan.label, value: plan.key })),
    [data?.plans],
  );

  const flagLabelByKey = useMemo(
    () => new Map((flagsData || []).map((flag: any) => [flag.key, flag.label || flag.key])),
    [flagsData],
  );

  const savePlan = async () => {
    try {
      const values = await planForm.validateFields();
      await lambdaClient.admin.upsertPlan.mutate({
        config: values.config ? JSON.parse(values.config) : {},
        description: values.description,
        isActive: values.isActive,
        key: values.key,
        label: values.label,
        monthlyCredits: {
          audio: values.audioCredits || 0,
          chat: values.chatCredits || 0,
          image: values.imageCredits || 0,
          video: values.videoCredits || 0,
        },
        sortOrder: values.sortOrder || 100,
      });
      message.success('Plan saved');
      setPlanOpen(false);
      planForm.resetFields();
      mutate('admin:plans');
    } catch (error) {
      message.error(error instanceof SyntaxError ? 'Config JSON is invalid' : 'Save failed');
    }
  };

  const assignPlan = async () => {
    try {
      const values = await assignForm.validateFields();
      await lambdaClient.admin.assignUserPlan.mutate(values);
      message.success('User plan assigned');
      setAssignOpen(false);
      assignForm.resetFields();
      mutate('admin:plans');
    } catch {
      message.error('Assignment failed');
    }
  };

  const setPlanFeature = async (planKey: string, flagKey: string, enabled: boolean) => {
    try {
      await lambdaClient.admin.setPlanFeature.mutate({ enabled, flagKey, planKey });
      mutate('admin:plans');
    } catch {
      message.error('Feature update failed');
    }
  };

  const openPlanEditor = (plan?: any) => {
    if (plan) {
      planForm.setFieldsValue({
        audioCredits: plan.monthlyCredits?.audio || 0,
        chatCredits: plan.monthlyCredits?.chat || 0,
        config: JSON.stringify(plan.config || {}, null, 2),
        description: plan.description,
        imageCredits: plan.monthlyCredits?.image || 0,
        isActive: plan.isActive,
        key: plan.key,
        label: plan.label,
        sortOrder: plan.sortOrder,
        videoCredits: plan.monthlyCredits?.video || 0,
      });
    } else {
      planForm.resetFields();
      planForm.setFieldsValue({ isActive: true, sortOrder: 100 });
    }
    setPlanOpen(true);
  };

  if (isLoading) return <Spin size="large" style={{ marginTop: 48 }} />;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={() => openPlanEditor()}>
          <AdminLabel icon={adminIcons.plans}>Create or Edit Plan</AdminLabel>
        </Button>
        <Button onClick={() => setAssignOpen(true)}>
          <AdminLabel icon={adminIcons.users}>Assign User Plan</AdminLabel>
        </Button>
      </Space>

      <Tabs
        items={[
          {
            key: 'plans',
            label: <AdminLabel icon={adminIcons.plans}>Plans</AdminLabel>,
            children: (
              <Table
                dataSource={data?.plans || []}
                rowKey="key"
                columns={[
                  {
                    dataIndex: 'label',
                    key: 'label',
                    title: <AdminLabel icon={adminIcons.plan}>Plan</AdminLabel>,
                  },
                  {
                    dataIndex: 'key',
                    key: 'key',
                    title: <AdminLabel icon={adminIcons.key}>Key</AdminLabel>,
                  },
                  {
                    dataIndex: 'description',
                    key: 'description',
                    title: <AdminLabel icon={adminIcons.description}>Description</AdminLabel>,
                  },
                  {
                    dataIndex: 'monthlyCredits',
                    key: 'monthlyCredits',
                    title: <AdminLabel icon={adminIcons.value}>Monthly Credits</AdminLabel>,
                    render: (credits: any) =>
                      [
                        `Chat ${credits?.chat || 0}`,
                        `Image ${credits?.image || 0}`,
                        `Video ${credits?.video || 0}`,
                        `Audio ${credits?.audio || 0}`,
                      ].join(' / '),
                  },
                  {
                    dataIndex: 'sortOrder',
                    key: 'sortOrder',
                    title: <AdminLabel icon={adminIcons.updated}>Order</AdminLabel>,
                  },
                  {
                    dataIndex: 'isActive',
                    key: 'isActive',
                    title: <AdminLabel icon={adminIcons.featureFlags}>Active</AdminLabel>,
                    render: Boolean,
                  },
                  {
                    key: 'actions',
                    title: <AdminLabel icon={adminIcons.actions}>Actions</AdminLabel>,
                    render: (_: unknown, record: any) => (
                      <Button size="small" onClick={() => openPlanEditor(record)}>
                        Edit
                      </Button>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'features',
            label: <AdminLabel icon={adminIcons.featureFlags}>Plan Features</AdminLabel>,
            children: (
              <Table
                dataSource={data?.planFeatures || []}
                rowKey="id"
                columns={[
                  {
                    dataIndex: 'planKey',
                    key: 'planKey',
                    title: <AdminLabel icon={adminIcons.plan}>Plan</AdminLabel>,
                  },
                  {
                    dataIndex: 'flagKey',
                    key: 'flagKey',
                    title: <AdminLabel icon={adminIcons.featureFlags}>Feature</AdminLabel>,
                    render: (flagKey: string) =>
                      `${flagLabelByKey.get(flagKey) || flagKey} (${flagKey})`,
                  },
                  {
                    dataIndex: 'enabled',
                    key: 'enabled',
                    title: <AdminLabel icon={adminIcons.featureFlags}>Enabled</AdminLabel>,
                    render: (enabled: boolean, record: any) => (
                      <Switch
                        checked={enabled}
                        onChange={(next) => setPlanFeature(record.planKey, record.flagKey, next)}
                      />
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'assignments',
            label: <AdminLabel icon={adminIcons.users}>User Assignments</AdminLabel>,
            children: (
              <Table
                dataSource={data?.userPlans || []}
                rowKey="id"
                columns={[
                  {
                    dataIndex: 'userId',
                    key: 'userId',
                    title: <AdminLabel icon={adminIcons.users}>User ID</AdminLabel>,
                  },
                  {
                    dataIndex: 'planKey',
                    key: 'planKey',
                    title: <AdminLabel icon={adminIcons.plan}>Plan</AdminLabel>,
                  },
                  {
                    dataIndex: 'notes',
                    key: 'notes',
                    title: <AdminLabel icon={adminIcons.description}>Notes</AdminLabel>,
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        open={planOpen}
        title={<AdminLabel icon={adminIcons.plans}>Pricing Plan</AdminLabel>}
        onCancel={() => setPlanOpen(false)}
        onOk={savePlan}
      >
        <Form form={planForm} initialValues={{ isActive: true, sortOrder: 100 }} layout="vertical">
          <Form.Item label={<AdminLabel icon={adminIcons.key}>Key</AdminLabel>} name="key" rules={[{ required: true }]}>
            <Input placeholder="starter" />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.email}>Label</AdminLabel>} name="label" rules={[{ required: true }]}>
            <Input placeholder="Starter" />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.description}>Description</AdminLabel>} name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space.Compact block>
            <Form.Item label={<AdminLabel icon={adminIcons.value}>Chat</AdminLabel>} name="chatCredits" style={{ width: '25%' }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={<AdminLabel icon={adminIcons.value}>Image</AdminLabel>} name="imageCredits" style={{ width: '25%' }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={<AdminLabel icon={adminIcons.value}>Video</AdminLabel>} name="videoCredits" style={{ width: '25%' }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={<AdminLabel icon={adminIcons.value}>Audio</AdminLabel>} name="audioCredits" style={{ width: '25%' }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Form.Item label={<AdminLabel icon={adminIcons.updated}>Sort Order</AdminLabel>} name="sortOrder">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.description}>Config JSON</AdminLabel>} name="config">
            <Input.TextArea placeholder='{"support":"priority"}' rows={3} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.featureFlags}>Active</AdminLabel>} name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={assignOpen}
        title={<AdminLabel icon={adminIcons.users}>Assign User Plan</AdminLabel>}
        onCancel={() => setAssignOpen(false)}
        onOk={assignPlan}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item label={<AdminLabel icon={adminIcons.users}>User</AdminLabel>} name="userId" rules={[{ required: true }]}>
            <Select
              showSearch
              options={(usersData || []).map((u: any) => ({
                label: `${u.email || u.id} (${u.id.slice(0, 8)})`,
                value: u.id,
              }))}
            />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.plan}>Plan</AdminLabel>} name="planKey" rules={[{ required: true }]}>
            <Select options={planOptions} />
          </Form.Item>
          <Form.Item label={<AdminLabel icon={adminIcons.description}>Notes</AdminLabel>} name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminPlansPage;
