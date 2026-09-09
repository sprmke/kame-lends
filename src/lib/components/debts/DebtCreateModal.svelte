<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import DebtForm from '$lib/components/debts/DebtForm.svelte';
	import { Loader2 } from 'lucide-svelte';
	import type { Investor } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess?: () => void;
		preselectedInvestorId?: number;
	}

	let { open, onOpenChange, onSuccess, preselectedInvestorId }: Props = $props();

	let investors = $state<Investor[]>([]);
	let isLoading = $state(false);

	$effect(() => {
		if (!open) return;
		let active = true;
		isLoading = true;
		fetch('/api/investors?simple=true')
			.then((response) => response.json())
			.then((data) => {
				if (active && Array.isArray(data)) investors = data;
			})
			.catch((error) => console.error('Error fetching investors:', error))
			.finally(() => {
				if (active) isLoading = false;
			});
		return () => {
			active = false;
		};
	});

	function handleSuccess() {
		onOpenChange(false);
		onSuccess?.();
	}
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class="dashboard-dialog-wide max-h-[90vh] overflow-y-auto">
		<Dialog.Header class="sr-only">
			<Dialog.Title>Create Borrowing</Dialog.Title>
		</Dialog.Header>
		{#if isLoading}
			<div class="flex h-[60vh] flex-col items-center justify-center gap-4">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		{:else}
			<DebtForm
				{investors}
				{preselectedInvestorId}
				cancelHref="#"
				onSuccess={handleSuccess}
				onCancel={() => onOpenChange(false)}
			/>
		{/if}
	</Dialog.Content>
</Dialog.Root>
