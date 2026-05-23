'use client';

import { type FC } from 'react';
import { Outlet } from 'react-router-dom';

import { AdminLayout } from '@/features/Admin';

const Layout: FC = () => {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
};

export default Layout;
