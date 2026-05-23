'use client';

import { Flexbox } from '@lobehub/ui';
import { Outlet } from 'react-router-dom';

import GenerationTypeSelector from '@/routes/(main)/(create)/features/GenerationLayout/GenerationTypeSelector';

const CreateLayout = () => {
  return (
    <Flexbox height="100%" style={{ flexDirection: 'column' }}>
      <GenerationTypeSelector />
      <Flexbox horizontal flex={1}>
        <Outlet />
      </Flexbox>
    </Flexbox>
  );
};

export default CreateLayout;
