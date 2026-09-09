<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';
	import ScrollReveal from './ScrollReveal.svelte';
	import DashboardPreview from './mockups/DashboardPreview.svelte';
	import LoansPreview from './mockups/LoansPreview.svelte';
	import InvestorsPreview from './mockups/InvestorsPreview.svelte';
	import TransactionsPreview from './mockups/TransactionsPreview.svelte';
	import { APP_NAME } from '$lib/brand';
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';

	type TabId = 'dashboard' | 'loans' | 'investors' | 'transactions';

	const allTabs: Array<{
		id: TabId;
		label: string;
		description: string;
		component: Component;
	}> = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			description: 'Summary metrics, charts, and activity at a glance.',
			component: DashboardPreview
		},
		{
			id: 'loans',
			label: 'Loans',
			description: 'Track Lot Title, OR/CR, and Agent loans with statuses.',
			component: LoansPreview
		},
		{
			id: 'investors',
			label: 'Investors',
			description: 'Capital, returns, and active loan participation.',
			component: InvestorsPreview
		},
		{
			id: 'transactions',
			label: 'Transactions',
			description: 'Full ledger of collections, disbursements, and returns.',
			component: TransactionsPreview
		}
	];

	const tabs = allTabs.filter((tab) => SHOW_TRANSACTIONS_UI || tab.id !== 'transactions');
	let active = $state<TabId>(tabs[0].id);
	const activeTab = $derived(tabs.find((t) => t.id === active) ?? tabs[0]);
</script>

<section id="showcase" class="scroll-mt-24 py-24 sm:py-32">
	<div class="mx-auto max-w-7xl px-5 sm:px-8">
		<ScrollReveal class="mx-auto max-w-2xl text-center">
			<p class="section-eyebrow">Product Tour</p>
			<h2 class="mt-3 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
				See {APP_NAME} in action
			</h2>
			<p class="mt-5 text-lg text-muted-foreground">
				Browse real app screens with amounts shown, and see how your team will manage loans,
				investors, and cashflow every day.
			</p>
		</ScrollReveal>

		<ScrollReveal delay={150} class="mt-12">
			<div class="flex flex-wrap justify-center gap-2">
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						onclick={() => (active = tab.id)}
						class={cn(
							'rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-300',
							active === tab.id
								? 'bg-primary text-primary-foreground shadow-[var(--shadow-soft)]'
								: 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<p class="mx-auto mt-4 max-w-xl text-center text-sm text-muted-foreground">
				{activeTab.description}
			</p>
		</ScrollReveal>

		<ScrollReveal delay={250} class="mt-10">
			<div class="relative mx-auto max-w-4xl transition-all duration-500">
				<div
					class="landing-showcase-glow pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] opacity-60"
				></div>
				{#key active}
					<div class="landing-tab-enter">
						<activeTab.component />
					</div>
				{/key}
			</div>
		</ScrollReveal>
	</div>
</section>
