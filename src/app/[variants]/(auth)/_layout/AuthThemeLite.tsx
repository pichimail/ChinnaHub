'use client';

import { ThemeProvider } from '@lobehub/ui';
import type { PropsWithChildren } from 'react';
import { memo, useEffect, useState } from 'react';

interface AuthThemeLiteProps extends PropsWithChildren {
  appearance?: 'dark' | 'light' | 'auto';
  defaultAppearance?: 'dark' | 'light' | 'auto';
}

const AuthThemeLite = memo<AuthThemeLiteProps>(({ children, appearance, defaultAppearance }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentAppearance = appearance || defaultAppearance || 'dark';

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        className="auth-layout"
        style={{
          height: '100%',
          minHeight: 'inherit',
          width: 'inherit',
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <ThemeProvider
      appearance={currentAppearance}
      className="auth-layout"
      defaultAppearance={currentAppearance}
      style={{
        height: '100%',
        minHeight: 'inherit',
        width: 'inherit',
      }}
    >
      {children}
    </ThemeProvider>
  );
});

AuthThemeLite.displayName = 'AuthThemeLite';

export default AuthThemeLite;
