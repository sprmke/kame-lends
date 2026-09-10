<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import LoanSigningSection from './LoanSigningSection.svelte';
	import LoanContractSavedEditor from './LoanContractSavedEditor.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Download } from 'lucide-svelte';
	import { downloadLoanContract } from '$lib/download-loan-contract';
	import type { Borrower, Investor, LoanWithInvestors } from '$lib/types';
	import type { ContractCustomization } from '$lib/loan-contract-customization';

	interface Props {
		loan: LoanWithInvestors;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		canEdit?: boolean;
		borrowers?: Borrower[];
		investors?: Investor[];
		onSaved?: () => void | Promise<void>;
	}

	let {
		loan,
		open,
		onOpenChange,
		canEdit = false,
		borrowers = [],
		investors = [],
		onSaved
	}: Props = $props();

	let isDownloadingContract = $state(false);
	let signedCount = $state(0);
	let totalCount = $state(0);
	let signingRefreshKey = $state(0);
	let contractDirty = $state(false);
	let saveContract = $state<(() => Promise<void>) | null>(null);

	$effect(() => {
		if (!open) {
			signedCount = 0;
			totalCount = 0;
			contractDirty = false;
			saveContract = null;
		}
	});

	async function handleDownload() {
		isDownloadingContract = true;
		try {
			await downloadLoanContract(loan);
		} finally {
			isDownloadingContract = false;
		}
	}

	function handleStatsChange(signed: number, total: number) {
		signedCount = signed;
		totalCount = total;
	}

	async function handleContractSaved(_customization: ContractCustomization) {
		signingRefreshKey += 1;
		await onSaved?.();
	}
</script>

<ResponsiveModal
	{open}
	{onOpenChange}
	contentClass="dashboard-dialog-wide !max-w-5xl"
	bodyClass="space-y-6"
>
	{#snippet header()}
		<div class="flex min-w-0 flex-wrap items-center gap-2">
			<h2 class="min-w-0 text-base font-medium tracking-tight md:text-lg">Contract details</h2>
			{#if totalCount > 0}
				<Badge variant="secondary" class="shrink-0">{signedCount} of {totalCount} signed</Badge>
			{/if}
		</div>
	{/snippet}

	{#if open}
		{#key loan.id}
			<LoanSigningSection
				loanId={loan.id}
				variant="plain"
				refreshKey={signingRefreshKey}
				onStatsChange={handleStatsChange}
			/>

			<LoanContractSavedEditor
				{loan}
				{canEdit}
				{borrowers}
				{investors}
				onDirtyChange={(dirty) => (contractDirty = dirty)}
				onRegisterSave={(save) => (saveContract = save)}
				onSaved={handleContractSaved}
			/>
		{/key}
	{/if}

	{#snippet footer()}
		<div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			{#if canEdit}
				<Button
					type="button"
					class="w-full sm:w-auto"
					disabled={!contractDirty || !saveContract}
					onclick={() => saveContract?.()}
				>
					Save contract
				</Button>
			{/if}
			<Button
				type="button"
				variant="outline"
				class="w-full sm:w-auto"
				disabled={isDownloadingContract}
				onclick={handleDownload}
			>
				<Download class="mr-2 h-4 w-4" />
				{isDownloadingContract ? 'Generating...' : 'Download contract'}
			</Button>
		</div>
	{/snippet}
</ResponsiveModal>
