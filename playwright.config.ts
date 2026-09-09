import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

const previewPort = 4174;
const localEnv = loadEnv('development', process.cwd(), '');
for (const [key, value] of Object.entries(localEnv)) {
	if (process.env[key] === undefined) process.env[key] = value;
}

const e2eAuthSecret = process.env.E2E_AUTH_SECRET ?? 'e2e-local-secret';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	use: {
		baseURL: `http://localhost:${previewPort}`,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'smoke',
			testMatch: /smoke\.spec\.ts/
		},
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/
		},
		{
			name: 'authenticated',
			testMatch: /authenticated-routes\.spec\.ts/,
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				storageState: 'e2e/.auth/admin.json'
			}
		},
		{
			name: 'modals',
			testMatch: /modal-interactions\.spec\.ts/,
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				storageState: 'e2e/.auth/admin.json',
				viewport: { width: 1440, height: 900 }
			}
		}
	],
	webServer: {
		command: `bun run dev --port ${previewPort}`,
		port: previewPort,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			...process.env,
			E2E_AUTH_SECRET: e2eAuthSecret,
			AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-playwright-auth-secret-min-32-chars'
		}
	}
});
