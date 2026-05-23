'use client';

import { Button, Flexbox } from '@lobehub/ui';
import { Card, Divider, Input, InputNumber, Switch } from 'antd';
import { memo, useCallback, useState } from 'react';

const AdminAudioSettings = memo(() => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(3000);
  const [testing, setTesting] = useState(false);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    try {
      // TODO: Test connection to audio generation API
      // Simulate successful test
      setTimeout(() => {
        setTesting(false);
      }, 1000);
    } catch (error) {
      console.error('Connection test failed:', error);
      setTesting(false);
    }
  }, [apiKey]);

  const handleSaveSettings = useCallback(() => {
    const settings = {
      apiKey,
      isEnabled,
      pollingInterval,
    };
    // TODO: Save to database or store
    void settings;
  }, [apiKey, isEnabled, pollingInterval]);

  return (
    <Card style={{ marginBottom: '24px' }} title="Audio Generation Settings">
      <Flexbox gap="lg">
        <div>
          <label>Enable Audio Generation</label>
          <Switch checked={isEnabled} style={{ marginLeft: '12px' }} onChange={setIsEnabled} />
        </div>

        <Divider />

        <div>
          <label>API Key</label>
          <Flexbox horizontal align="center" gap="sm">
            <Input
              placeholder="Enter Suno API key"
              style={{ flex: 1 }}
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? 'Hide' : 'Show'}
            </Button>
          </Flexbox>
        </div>

        <div>
          <label>Polling Interval (ms)</label>
          <InputNumber
            max={10000}
            min={1000}
            style={{ width: '100%' }}
            value={pollingInterval}
            onChange={(value) => value && setPollingInterval(value)}
          />
        </div>

        <Flexbox horizontal gap="sm">
          <Button loading={testing} onClick={handleTestConnection}>
            Test Connection
          </Button>
          <Button type="primary" onClick={handleSaveSettings}>
            Save Settings
          </Button>
        </Flexbox>
      </Flexbox>
    </Card>
  );
});

AdminAudioSettings.displayName = 'AdminAudioSettings';

export default AdminAudioSettings;
