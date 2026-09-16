<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import {
		LOAN_SCOPE_TABS,
		resolveLoanScopeTab,
		type LoanScopeParam
	} from '$lib/loans/loan-list-scope-nav';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	const activeParam = $derived(
		resolveLoanScopeTab(page.url.searchParams.get('scope')).param
	);

	function selectScope(param: LoanScopeParam) {
		const url = new URL(page.url);
		if (param === 'mine') {
			url.searchParams.delete('scope');
		} else {
			url.searchParams.set('scope', param);
		}
		void goto(`${url.pathname}${url.search}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});
	}
</script>

<div
	class={cn(
		'flex gap-1 overflow-x-auto rounded-2xl bg-muted/60 p-1',
		className
	)}
	role="tablist"
	aria-label="Loan list"
>
	{#each LOAN_SCOPE_TABS as tab (tab.param)}
		<button
			type="button"
			role="tab"
			aria-selected={activeParam === tab.param}
			class={cn(
				'shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
				activeParam === tab.param
					? 'bg-card text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'
			)}
			onclick={() => selectScope(tab.param)}
		>
			{tab.label}
		</button>
	{/each}
</div>
