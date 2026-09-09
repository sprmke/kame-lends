<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import InvestorForm from '$lib/components/investors/InvestorForm.svelte';
	import type { Investor } from '$lib/types';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onSuccess: (investor: Investor) => void | Promise<void>;
	}

	let { open, onOpenChange, onSuccess }: Props = $props();

	async function handleSuccess(investor: Investor) {
		onOpenChange(false);
		await onSuccess(investor);
	}
</script>

<ResponsiveModal {open} {onOpenChange} title="Add Investor" contentClass="sm:max-w-lg">
	<InvestorForm onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
</ResponsiveModal>
