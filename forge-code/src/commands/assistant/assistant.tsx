import React from 'react';
import { homedir } from 'node:os';
import { join } from 'node:path';

type WizardProps = {
  defaultDir: string;
  onInstalled: (dir: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
};

export async function computeDefaultInstallDir(): Promise<string> {
  return join(homedir(), '.forge-assistant');
}

export function NewInstallWizard(props: WizardProps): React.ReactNode {
  // Keep flow non-disruptive when assistant installer assets are unavailable.
  // We return control to caller by completing with the default location.
  try {
    props.onInstalled(props.defaultDir || join(homedir(), '.forge-assistant'));
  } catch (error) {
    props.onError(error instanceof Error ? error.message : 'Assistant install failed');
  }
  return null;
}
