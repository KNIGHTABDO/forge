import React from 'react';
import { Box, Text } from 'src/ink.js';

export function WelcomeV2() {
  return (
    <Box paddingLeft={0} paddingTop={1} paddingBottom={0} flexDirection="column">
      <Text>
        <Text color="Forge">{"Welcome to Forge Code"} </Text>
        <Text dimColor={true}>v{MACRO.DISPLAY_VERSION ?? MACRO.VERSION} </Text>
      </Text>
      <Text dimColor={true}>{"\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026\u2026"}</Text>
    </Box>
  );
}

export function AppleTerminalWelcomeV2({ welcomeMessage }: { theme: any, welcomeMessage: string }) {
  return (
    <Box paddingLeft={1} paddingTop={1} paddingBottom={0}>
      <Text>
        <Text color="Forge">{welcomeMessage} </Text>
        <Text dimColor={true}>v{MACRO.DISPLAY_VERSION ?? MACRO.VERSION} </Text>
      </Text>
    </Box>
  );
}
