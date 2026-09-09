<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import BorrowerForm from '$lib/components/borrowers/BorrowerForm.svelte';
	import type { Borrower } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess: (borrower: Borrower) => void | Promise<void>;
	}

	let { open, onOpenChange, onSuccess }: Props = $props();

	async function handleSuccess(borrower: Borrower) {
		onOpenChange(false);
		await onSuccess(borrower);
	}
</script>

<ResponsiveModal {open} {onOpenChange} title="Add Borrower" contentClass="sm:max-w-lg">
	<BorrowerForm onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
</ResponsiveModal>
