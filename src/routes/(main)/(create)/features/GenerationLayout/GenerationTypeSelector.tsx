'use client';

import { Flexbox } from '@lobehub/ui';
import { Select } from 'antd';
import { memo, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GenerationTypeSelector = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  const options = [
    { label: '🖼️ Image', value: 'image' },
    { label: '🎬 Video', value: 'video' },
  ];

  const currentType = useMemo(() => {
    if (location.pathname.includes('/image')) return 'image';
    if (location.pathname.includes('/video')) return 'video';
    return 'image';
  }, [location.pathname]);

  const handleChange = (value: string) => {
    navigate(`/${value}`);
  };

  return (
    <Flexbox horizontal padding="md">
      <label style={{ marginRight: '8px', fontWeight: 500 }}>Generation Type:</label>
      <Select
        options={options}
        style={{ width: '150px' }}
        value={currentType}
        onChange={handleChange}
      />
    </Flexbox>
  );
});

GenerationTypeSelector.displayName = 'GenerationTypeSelector';

export default GenerationTypeSelector;
