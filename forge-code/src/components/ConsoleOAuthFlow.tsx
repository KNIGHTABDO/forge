import React, { useEffect } from 'react';
import { Box, Text } from 'src/ink.js';
import { logEvent } from 'src/services/analytics/index.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { Select } from './CustomSelect/select.js';

type Props = {
  onDone(): void;
  startingMessage?: string;
  mode?: 'login' | 'setup-token';
  forceLoginMethod?: 'claudeai' | 'console';
};

export function ConsoleOAuthFlow({ onDone, startingMessage }: Props) {
  useEffect(() => {
    logEvent('tengu_oauth_claudeai_forced', {});
  }, []);

  useKeybinding('confirm:yes', () => {
    onDone();
  }, { context: 'Confirmation', isActive: true });

  const t1 = startingMessage ? startingMessage : "Forge Code requires an active session to use your local development models.";

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold={true}>{t1}</Text>
      <Text>Select login method:</Text>
      <Box>
        <Select 
          options={[
            {
              label: <Text>Forge CLI Login · <Text dimColor={true}>Local keys or Gemini integrations</Text>{"\n"}</Text>,
              value: "claudeai"
            },
            {
              label: <Text>Anthropic Console account · <Text dimColor={true}>API usage billing</Text>{"\n"}</Text>,
              value: "console"
            },
            {
              label: <Text>3rd-party platform · <Text dimColor={true}>Amazon Bedrock, Microsoft Foundry, or Vertex AI</Text>{"\n"}</Text>,
              value: "platform"
            }
          ]} 
          onChange={(value) => {
            if (value === "claudeai") {
              onDone();
            }
          }} 
        />
      </Box>
    </Box>
  );
}
