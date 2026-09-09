<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils';
	import ScrollReveal from './ScrollReveal.svelte';
	import NewLoanPreview from './mockups/NewLoanPreview.svelte';
	import CalendarPreview from './mockups/CalendarPreview.svelte';
	import LoanDetailPreview from './mockups/LoanDetailPreview.svelte';

	type WorkflowId = 'create-loan' | 'calendar' | 'loan-detail';

	const workflows: Array<{
		id: WorkflowId;
		label: string;
		description: string;
		component: Component;
	}> = [
		{
			id: 'create-loan',
			label: 'Create Loan',
			description: 'Set loan details and assign investors.',
			component: NewLoanPreview
		},
		{
			id: 'calendar',
			label: 'Calendar',
			description: 'See disbursements and due dates on a calendar.',
			component: CalendarPreview
		},
		{
			id: 'loan-detail',
			label: 'Loan Detail',
			description: 'Track principal, investors, and interest periods.',
			component: LoanDetailPreview
		}
	];

	let active = $state<WorkflowId>('create-loan');
	const activeWorkflow = $derived(workflows.find((w) => w.id === active) ?? workflows[0]);
</script>

<div class="relative mx-auto max-w-lg lg:max-w-none">
	<div
		class="landing-showcase-glow pointer-events-none absolute -inset-3 -z-10 rounded-[1.75rem] opacity-40 sm:-inset-4"
	></div>

	<ScrollReveal delay={100}>
		<div class="flex flex-wrap justify-center gap-2 lg:justify-start">
			{#each workflows as workflow (workflow.id)}
				<button
					type="button"
					onclick={() => (active = workflow.id)}
					class={cn(
						'rounded-2xl px-4 py-2 text-xs font-semibold transition-all duration-300 sm:px-5 sm:text-sm',
						active === workflow.id
							? 'bg-primary text-primary-foreground shadow-[var(--shadow-soft)]'
							: 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
					)}
				>
					{workflow.label}
				</button>
			{/each}
		</div>
		<p class="mt-3 text-center text-sm text-muted-foreground lg:text-left">
			{activeWorkflow.description}
		</p>
	</ScrollReveal>

	<ScrollReveal delay={200} class="mt-6">
		{#key active}
			<div class="landing-tab-enter">
				<activeWorkflow.component />
			</div>
		{/key}
	</ScrollReveal>
</div>
