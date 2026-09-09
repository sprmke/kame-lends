<script lang="ts">
	import type { LoanContractData } from '$lib/loan-contract-data';
	import { getContractDetailRows } from '$lib/loan-contract-data';
	import {
		getContractIntroText,
		getContractTermClauses,
		getContractTitle
	} from '$lib/loan-contract-content';
	import type { ContractCustomization } from '$lib/loan-contract-customization';

	interface Props {
		data: LoanContractData;
		customization: ContractCustomization;
	}

	let { data, customization }: Props = $props();

	const rows = $derived(getContractDetailRows(data));
	const title = $derived(getContractTitle(data.loanType));
	const intro = $derived(getContractIntroText(data, customization));
	const clauses = $derived(getContractTermClauses(data, customization));
</script>

<div class="max-h-[70vh] overflow-y-auto p-4 text-sm leading-relaxed sm:p-6">
	<h2 class="mb-4 text-center text-lg font-bold">{title}</h2>
	<p class="mb-6 whitespace-pre-wrap text-muted-foreground">{intro}</p>

	<div class="mb-6 overflow-hidden rounded-md border border-border">
		{#each rows as row}
			<div class="grid grid-cols-[38%_1fr] border-b border-border last:border-b-0">
				<div class="bg-muted/60 px-3 py-2 font-medium text-muted-foreground">{row.label}</div>
				<div class="px-3 py-2">{row.value}</div>
			</div>
		{/each}
	</div>

	<div class="space-y-4">
		{#each clauses as clause, index}
			<p class="text-muted-foreground">
				<span class="font-semibold text-foreground">{index + 1}. </span>
				{clause.text}
			</p>
		{/each}
	</div>
</div>
