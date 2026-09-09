import { test, expect } from '@playwright/test';
import { fetchJson, gotoApp, skipIfNoDatabase } from './helpers';
import type { Borrower, Investor, Transaction } from '$lib/types';

test.describe.configure({ mode: 'serial', timeout: 120_000, retries: 1 });

// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
	skipIfNoDatabase(testInfo);
});

test('create and delete an investor', async ({ page, request }) => {
	const stamp = Date.now();
	const response = await gotoApp(page, '/investors/new');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Create Investor' })).toBeVisible({
		timeout: 20_000
	});
	await page.waitForLoadState('networkidle');

	await page.getByLabel('Full Name').fill(`E2E Investor ${stamp}`);
	await page.getByLabel('Email Address').fill(`e2e-investor-${stamp}@example.com`);
	await page.getByLabel('Contact Number').fill('09171234567');
	await page.getByLabel('Address', { exact: true }).fill('123 Test St');

	const createResponsePromise = page.waitForResponse((res) => res.url().includes('/api/investors'));
	await page.getByRole('button', { name: 'Create Investor' }).last().click();
	const createResponse = await createResponsePromise;
	expect(createResponse.status()).toBe(201);

	await expect(page).toHaveURL(/\/investors\/?$/);

	const email = `e2e-investor-${stamp}@example.com`;
	await expect
		.poll(
			async () => {
				const investors = await fetchJson<Array<Investor>>(request, '/api/investors?simple=true');
				return investors?.find((i) => i.email === email);
			},
			{ timeout: 30_000 }
		)
		.toBeDefined();

	const created = await fetchJson<Array<Investor>>(request, '/api/investors?simple=true').then(
		(list) => list?.find((i) => i.email === email)
	);
	expect(created).toBeDefined();

	await page.getByPlaceholder('Search investors...').fill(`E2E Investor ${stamp}`);
	await expect(
		page.locator('table tbody tr').filter({ hasText: `E2E Investor ${stamp}` })
	).toBeVisible({ timeout: 30_000 });

	const del = await request.delete(`/api/investors/${created!.id}`);
	expect(del.ok(), await del.text()).toBeTruthy();
});

test('edit an investor', async ({ page, request }) => {
	const stamp = Date.now();
	const createRes = await request.post('/api/investors', {
		data: {
			name: `E2E Edit Investor ${stamp}`,
			email: `e2e-edit-inv-${stamp}@example.com`,
			contactNumber: '09170000000'
		}
	});
	expect(createRes.ok(), await createRes.text()).toBeTruthy();
	const investor = (await createRes.json()) as Investor;

	const response = await gotoApp(page, `/investors/${investor.id}`);
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible({ timeout: 20_000 });
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Actions' }).click();
	await page.getByRole('menuitem', { name: /edit/i }).click();

	await expect(page.getByRole('heading', { name: 'Edit Investor', exact: true })).toBeVisible();
	await page.getByLabel('Contact Number').fill('09171111111');

	const updateResponsePromise = page.waitForResponse((res) =>
		res.url().includes(`/api/investors/${investor.id}`)
	);
	await page.getByRole('button', { name: 'Update Investor' }).last().click();
	const updateResponse = await updateResponsePromise;
	expect(updateResponse.status()).toBe(200);
	const updated = (await updateResponse.json()) as Investor;
	expect(updated.contactNumber).toBe('09171111111');

	const detailResponse = await gotoApp(page, `/investors/${investor.id}`);
	expect(detailResponse?.status()).toBe(200);
	await expect(page.getByText('09171111111')).toBeVisible({ timeout: 20_000 });

	const del = await request.delete(`/api/investors/${investor.id}`);
	expect(del.ok(), await del.text()).toBeTruthy();
});

test('create and delete a transaction', async ({ page, request }) => {
	const stamp = Date.now();

	const investors = await fetchJson<Array<Investor>>(request, '/api/investors?simple=true');
	const investor = investors?.[0];
	test.skip(!investor, 'No investors in database');

	const response = await gotoApp(page, '/transactions/new');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'New Transaction' })).toBeVisible({
		timeout: 20_000
	});
	await page.waitForLoadState('networkidle');

	await page.getByLabel('Name').fill(`E2E Transaction ${stamp}`);
	await page.getByLabel('Investor').click();
	await page.getByRole('option', { name: investor!.name }).click();
	await page.getByLabel('Amount').fill('5000');
	await page.getByRole('button', { name: 'Create Transaction' }).click();

	await expect(page).toHaveURL(/\/transactions/);
	await expect(page.getByText(`E2E Transaction ${stamp}`)).toBeVisible();

	const transactions = await fetchJson<Array<Transaction>>(request, '/api/transactions');
	const created = transactions?.find((t) => t.name === `E2E Transaction ${stamp}`);
	expect(created).toBeDefined();
	const del = await request.delete(`/api/transactions/${created!.id}`);
	expect(del.ok(), await del.text()).toBeTruthy();
});

test('create and delete a borrowing', async ({ page, request }) => {
	const stamp = Date.now();

	const investors = await fetchJson<Array<Investor>>(request, '/api/investors?simple=true');
	const investor = investors?.[0];
	test.skip(!investor, 'No investors in database');

	const response = await gotoApp(page, '/debts/new');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Create Borrowing' })).toBeVisible({
		timeout: 20_000
	});
	await page.waitForLoadState('networkidle');

	await page.getByRole('combobox').click();
	await page.getByRole('button', { name: investor!.name }).click();
	await page.keyboard.press('Escape');

	await page.locator('input[placeholder*="Personal loan" i]').fill(`E2E Borrowing ${stamp}`);
	await page.locator('input[placeholder="0.00"]').first().fill('25000');
	await page.locator('input[type="date"]').first().fill(new Date().toISOString().slice(0, 10));
	await page.locator('input[placeholder="e.g., 1.8612"]').fill('2');
	await page.locator('input[placeholder="e.g., 12"]').fill('6');

	const createResponsePromise = page.waitForResponse((res) => res.url().includes('/api/debts'));
	await page
		.getByRole('button', { name: /Create Borrowing/ })
		.last()
		.click();
	const createResponse = await createResponsePromise;
	expect(createResponse.status()).toBe(201);

	await expect(page).toHaveURL(/\/debts\/?$/);
	await expect(page.getByText(`E2E Borrowing ${stamp}`)).toBeVisible({ timeout: 30_000 });

	const debts = await fetchJson<Array<{ id: number; name: string }>>(request, '/api/debts');
	const created = debts?.find((d) => d.name === `E2E Borrowing ${stamp}`);
	expect(created).toBeDefined();
	const del = await request.delete(`/api/debts/${created!.id}`);
	expect(del.ok(), await del.text()).toBeTruthy();
});

test('create and delete a loan', async ({ page, request }) => {
	const stamp = Date.now();
	const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	const investorRes = await request.post('/api/investors', {
		data: {
			name: `E2E Loan Investor ${stamp}`,
			email: `e2e-loan-inv-${stamp}@example.com`,
			contactNumber: '09171234567',
			address: '123 Test St'
		}
	});
	expect(investorRes.ok(), await investorRes.text()).toBeTruthy();
	const investor = (await investorRes.json()) as Investor;

	const borrowerRes = await request.post('/api/borrowers', {
		data: { name: `E2E Loan Borrower ${stamp}` }
	});
	expect(borrowerRes.ok(), await borrowerRes.text()).toBeTruthy();
	const borrower = (await borrowerRes.json()) as Borrower;

	const response = await gotoApp(page, `/loans/new?investorId=${investor.id}`);
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Create Loan' })).toBeVisible({
		timeout: 20_000
	});
	await page.waitForLoadState('networkidle');

	await page.locator('#borrowerId').click();
	await page.getByRole('option', { name: borrower.name }).click();
	await page.locator('#loanName').fill(`E2E Loan ${stamp}`);
	await page.locator('#dueDate').fill(dueDate);
	await page.locator('#investors-section input[type="number"]').first().fill('50000');

	const createResponsePromise = page.waitForResponse((res) => res.url().includes('/api/loans'));
	await page.getByRole('button', { name: 'Create Loan' }).last().click();
	const createResponse = await createResponsePromise;
	expect(createResponse.status()).toBe(201);

	await expect(page).toHaveURL(/\/loans\/\d+\?signing=1/);
	const match = page.url().match(/\/loans\/(\d+)\?signing=1/);
	const loanId = match ? Number(match[1]) : null;
	expect(loanId).not.toBeNull();
	await page.waitForResponse((res) => res.url().includes(`/api/loans/${loanId}/signing`));
	await page.waitForLoadState('networkidle');

	const signingRes = await request.get(`/api/loans/${loanId}/signing`);
	expect(signingRes.ok(), await signingRes.text()).toBeTruthy();
	const signingData = (await signingRes.json()) as {
		invitations: Array<{ token: string | null; signingUrl: string }>;
	};
	const invitation = signingData.invitations[0];
	expect(invitation?.signingUrl).toContain(`/loans/${loanId}/sign`);
	expect(invitation?.token).toBeNull();

	const signPageResponse = await gotoApp(page, invitation.signingUrl);
	// Admin e2e user may not be a signing party; authenticated route still requires login.
	expect([200, 303, 403]).toContain(signPageResponse?.status() ?? 0);

	const delLoan = await request.delete(`/api/loans/${loanId}`);
	expect(delLoan.ok(), await delLoan.text()).toBeTruthy();

	const delInvestor = await request.delete(`/api/investors/${investor.id}`);
	expect(delInvestor.ok(), await delInvestor.text()).toBeTruthy();

	const delBorrower = await request.delete(`/api/borrowers/${borrower.id}`);
	expect(delBorrower.ok(), await delBorrower.text()).toBeTruthy();
});
