<script lang="ts">
	import { SHOW_TRANSACTIONS_UI } from '$lib/feature-flags';

	const allItems = [
		'Loan Tracking',
		'Investor Management',
		'Transaction Ledger',
		'Due Date Alerts',
		'Analytics Dashboard',
		'Multi Loan Types',
		'Secure & Private'
	];

	const items = allItems.filter((item) => SHOW_TRANSACTIONS_UI || item !== 'Transaction Ledger');
	const repeated = [...items, ...items];
</script>

<section class="overflow-hidden border-y border-border/50 bg-muted/30 py-10">
	<p
		class="mb-6 text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase"
	>
		Everything your lending operation needs
	</p>
	<div class="landing-marquee flex whitespace-nowrap">
		{#each repeated as item, i}
			<span
				class="mx-8 inline-flex items-center gap-3 text-sm font-semibold text-muted-foreground/80"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
				{item}
			</span>
		{/each}
	</div>
</section>
