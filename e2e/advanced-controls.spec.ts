import { test, expect } from '@playwright/test';
import { gotoApp, skipIfNoDatabase } from './helpers';
import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';

test.describe.configure({ mode: 'serial', timeout: 120_000, retries: 1 });

// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
	skipIfNoDatabase(testInfo);
});

test('settings page renders maintenance controls', async ({ page }) => {
	const response = await gotoApp(page, '/settings');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
		timeout: 20_000
	});
	await expect(page.getByRole('button', { name: 'Sync Due Dates' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Fix Payments' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Download Backup' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Calendar sync' })).toBeVisible();
});

test('loan create form opens new borrower modal', async ({ page }) => {
	const response = await gotoApp(page, '/loans/new');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Create Loan' })).toBeVisible({ timeout: 20_000 });
	await page.waitForLoadState('networkidle');

	await page.locator('#borrowerId').click();
	await page.getByRole('option', { name: 'Add New Borrower' }).click();

	await expect(page.getByRole('heading', { name: 'Add Borrower' })).toBeVisible({
		timeout: 10_000
	});

	await page.keyboard.press('Escape');
	await expect(page.getByRole('heading', { name: 'Create Loan' })).toBeVisible();
});

test('valid signing page renders signing controls', async ({ page, request }) => {
	const stamp = Date.now();
	const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
	const e2eEmail = process.env.E2E_USER_EMAIL?.trim() || `e2e-sign-inv-${stamp}@example.com`;

	const investorRes = await request.post('/api/investors', {
		data: {
			name: `E2E Sign Investor ${stamp}`,
			email: e2eEmail,
			contactNumber: '09171234567',
			address: '123 Test St'
		}
	});
	expect(investorRes.ok(), await investorRes.text()).toBeTruthy();
	const investor = (await investorRes.json()) as Investor;

	const borrowerRes = await request.post('/api/borrowers', {
		data: { name: `E2E Sign Borrower ${stamp}`, email: `e2e-sign-bor-${stamp}@example.com` }
	});
	expect(borrowerRes.ok(), await borrowerRes.text()).toBeTruthy();
	const borrower = (await borrowerRes.json()) as Borrower;

	const loanRes = await request.post('/api/loans', {
		data: {
			loanData: {
				loanName: `E2E Sign Loan ${stamp}`,
				borrowerId: borrower.id,
				type: 'Lot Title',
				status: 'Fully Funded',
				dueDate,
				notes: null
			},
			investorData: [
				{
					investorId: investor.id,
					amount: 50000,
					interestRate: 10,
					sentDate: new Date().toISOString().slice(0, 10)
				}
			]
		}
	});
	expect(loanRes.ok(), await loanRes.text()).toBeTruthy();
	const loan = (await loanRes.json()) as LoanWithInvestors;

	const signingRes = await request.get(`/api/loans/${loan.id}/signing`);
	expect(signingRes.ok(), await signingRes.text()).toBeTruthy();
	const signingData = (await signingRes.json()) as {
		invitations: Array<{ token: string | null; signingUrl: string }>;
	};
	const invitation = signingData.invitations.find((item) => item.signingUrl.includes(`/loans/${loan.id}/sign`));
	expect(invitation?.signingUrl).toContain(`/loans/${loan.id}/sign`);
	expect(invitation?.token).toBeNull();

	const response = await gotoApp(page, `/loans/${loan.id}/sign`);
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Sign Loan Agreement' })).toBeVisible({
		timeout: 20_000
	});
	await expect(page.getByRole('button', { name: 'I Agree and Sign Electronically' })).toBeVisible();
	await expect(page.locator('#signing-consent')).toBeVisible();

	await request.delete(`/api/loans/${loan.id}`);
	await request.delete(`/api/investors/${investor.id}`);
	await request.delete(`/api/borrowers/${borrower.id}`);
});

test('loan duplicate action pre-fills create form', async ({ page, request }) => {
	const stamp = Date.now();
	const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	const investorRes = await request.post('/api/investors', {
		data: {
			name: `E2E Dup Investor ${stamp}`,
			email: `e2e-dup-inv-${stamp}@example.com`,
			contactNumber: '09171234567',
			address: '123 Test St'
		}
	});
	expect(investorRes.ok(), await investorRes.text()).toBeTruthy();
	const investor = (await investorRes.json()) as Investor;

	const borrowerRes = await request.post('/api/borrowers', {
		data: { name: `E2E Dup Borrower ${stamp}` }
	});
	expect(borrowerRes.ok(), await borrowerRes.text()).toBeTruthy();
	const borrower = (await borrowerRes.json()) as Borrower;

	const loanRes = await request.post('/api/loans', {
		data: {
			loanData: {
				loanName: `E2E Dup Loan ${stamp}`,
				borrowerId: borrower.id,
				type: 'Lot Title',
				status: 'Fully Funded',
				dueDate,
				notes: null
			},
			investorData: [
				{
					investorId: investor.id,
					amount: 25000,
					interestRate: 8,
					sentDate: new Date().toISOString().slice(0, 10)
				}
			]
		}
	});
	expect(loanRes.ok(), await loanRes.text()).toBeTruthy();
	const loan = (await loanRes.json()) as LoanWithInvestors;

	const response = await gotoApp(page, `/loans/${loan.id}`);
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: `E2E Dup Loan ${stamp}` })).toBeVisible({
		timeout: 20_000
	});
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Actions' }).click();
	await page.getByRole('menuitem', { name: /duplicate/i }).click();

	await expect(page).toHaveURL(/\/loans\/new\?duplicate=/);
	await expect(page.getByRole('heading', { name: 'Duplicate Loan' })).toBeVisible({
		timeout: 20_000
	});
	await expect(page.locator('#loanName')).toHaveValue(`E2E Dup Loan ${stamp}`);

	await request.delete(`/api/loans/${loan.id}`);
	await request.delete(`/api/investors/${investor.id}`);
	await request.delete(`/api/borrowers/${borrower.id}`);
});
