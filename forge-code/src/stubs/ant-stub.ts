export const BROWSER_TOOLS = [];
export const API_RESIZE_PARAMS = {};
export const targetImage = () => ({});
export const CoordinateMode = {};
export const CuSubGate = {};
export const buildComputerUseTools = () => [];
export const bindSessionContext = (ctx: any) => ctx;
export const snip = (text: string) => text;
export const getFeatureValue = () => ({});
export const logEvent = () => {};
export const checkQuotaStatus = () => ({});
export const getSettings = () => ({});
export const createClaudeForChromeMcpServer = () => ({
	async start() {},
	async stop() {},
});

// @ant-ai/sandbox-runtime stub surface
export type FsReadRestrictionConfig = unknown;
export type FsWriteRestrictionConfig = unknown;
export type IgnoreViolationsConfig = unknown;
export type NetworkHostPattern = string;
export type NetworkRestrictionConfig = unknown;
export type SandboxAskCallback = (...args: any[]) => any;
export type SandboxDependencyCheck = unknown;
export type SandboxRuntimeConfig = unknown;
export type SandboxViolationEvent = unknown;

export class SandboxManager {
	constructor(_config?: unknown) {}
	updateConfig(_config?: unknown) {}

	static isSupportedPlatform(): boolean {
		return false;
	}

	static checkDependencies(_opts?: unknown): {
		errors: string[];
		warnings: string[];
	} {
		return { errors: [], warnings: [] };
	}

	static async initialize(_config?: unknown, _askCb?: unknown): Promise<void> {}

	static updateConfig(_config?: unknown): void {}

	static async reset(): Promise<void> {}

	static async wrapWithSandbox(
		command: string,
		_binShell?: string,
		_customConfig?: unknown,
		_abortSignal?: AbortSignal,
	): Promise<string> {
		return command;
	}

	static getFsReadConfig(): unknown {
		return {};
	}

	static getFsWriteConfig(): unknown {
		return {};
	}

	static getNetworkRestrictionConfig(): unknown {
		return {};
	}

	static getIgnoreViolations(): unknown {
		return {};
	}

	static getAllowUnixSockets(): boolean {
		return false;
	}

	static getAllowLocalBinding(): boolean {
		return false;
	}

	static getEnableWeakerNestedSandbox(): boolean {
		return false;
	}

	static getProxyPort(): number | undefined {
		return undefined;
	}

	static getSocksProxyPort(): number | undefined {
		return undefined;
	}

	static getLinuxHttpSocketPath(): string | undefined {
		return undefined;
	}

	static getLinuxSocksSocketPath(): string | undefined {
		return undefined;
	}

	static async waitForNetworkInitialization(): Promise<void> {}

	static getSandboxViolationStore(): SandboxViolationStore {
		return new SandboxViolationStore();
	}

	static annotateStderrWithSandboxFailures(stderr: string): string {
		return stderr;
	}

	static cleanupAfterCommand(): void {}
}

export const SandboxRuntimeConfigSchema = {
	safeParse: (value: unknown) => ({ success: true as const, data: value }),
};

export class SandboxViolationStore {
	addViolation(_event: unknown) {}
	getViolations() {
		return [];
	}
	clear() {}
}

// @ant-ai/mcpb stub surface
export async function getMcpConfigForManifest(_opts: unknown) {
	return null;
}

// Default export for require-style imports
export default {};
