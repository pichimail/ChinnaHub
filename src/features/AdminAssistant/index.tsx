'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import PageTitle from '@/components/PageTitle';

import AdminAssistantConversation from './AdminAssistantConversation';
import AdminAssistantProvider from './AdminAssistantProvider';

const AdminAssistantPage = memo(() => {
  const { t } = useTranslation('admin');

  return (
    <>
      <PageTitle title={t('assistantTitle')} />
      <Flexbox
        height={'100%'}
        style={{ minHeight: 0, overflow: 'hidden', position: 'relative' }}
        width={'100%'}
      >
        <AdminAssistantProvider>
          <AdminAssistantConversation />
        </AdminAssistantProvider>
      </Flexbox>
    </>
  );
});

AdminAssistantPage.displayName = 'AdminAssistantPage';

export default AdminAssistantPage;
