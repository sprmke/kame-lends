<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import LoanCommissionEditor from './LoanCommissionEditor.svelte';
	import type { LoanWithInvestors } from '$lib/types';

	interface Props {
		loan: LoanWithInvestors | null;
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onOpenChangeComplete?: (open: boolean) => void;
		onSaved?: () => void | Promise<void>;
	}

	let { loan, open, onOpenChange, onOpenChangeComplete, onSaved }: Props = $props();

	async function handleSaved() {
		await onSaved?.();
		onOpenChange(false);
	}
</script>

{#if loan}
	<ResponsiveModal
		{open}
		{onOpenChange}
		{onOpenChangeComplete}
		contentClass="dashboard-dialog-wide !max-w-lg"
		showCloseButton={false}
	>
		{#snippet header()}
			<h2 class="text-base font-medium tracking-tight">Your Commission</h2>
		{/snippet}

		{#if open}
			{#key loan.id}
				<LoanCommissionEditor
					{loan}
					onCancel={() => onOpenChange(false)}
					onSaved={handleSaved}
				/>
			{/key}
		{/if}
	</ResponsiveModal>
{/if}
