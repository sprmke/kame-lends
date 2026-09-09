import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import DashboardSkeleton from './DashboardSkeleton.svelte';
import ListPageSkeleton from './ListPageSkeleton.svelte';
import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';

describe('DashboardSkeleton', () => {
	it('mirrors the full dashboard layout', () => {
		const { body } = render(DashboardSkeleton);
		const cards = body.match(/data-slot="card"/g) ?? [];
		const summaryCount = 5;
		const activityCount = 4;
		const analyticsCount = SHOW_TRANSACTIONS_UI ? 2 : 1;
		const portfolioCount = 2;
		expect(cards.length).toBe(summaryCount + activityCount + analyticsCount + portfolioCount);
		expect(body).toContain('aria-label="Loading dashboard"');
		expect(body).toContain('grid-cols-2 md:grid-cols-3 2xl:grid-cols-5');
		expect(body).toContain('md:grid-cols-2 2xl:grid-cols-4');
		expect(body).toContain('lg:grid-cols-2');
	});
});

describe('ListPageSkeleton', () => {
	it('renders loans table columns', () => {
		const { body } = render(ListPageSkeleton, { props: { variant: 'loans' } });
		expect(body).toContain('grow-[12]');
		expect(body).toContain('aria-label="Loading page"');
	});

	it('renders investors table columns', () => {
		const { body } = render(ListPageSkeleton, { props: { variant: 'investors' } });
		expect(body).toContain('grow-[18]');
	});
});
