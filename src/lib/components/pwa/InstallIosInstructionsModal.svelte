<script lang="ts">
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { APP_NAME } from '$lib/brand';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}

	let { open, onOpenChange }: Props = $props();
</script>

<ResponsiveModal {open} {onOpenChange} title="Install {APP_NAME}" contentClass="sm:max-w-md">
	<ol class="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
		<li>Tap Share in the browser toolbar.</li>
		<li>Tap <span class="font-medium text-foreground">Add to Home Screen</span>.</li>
		<li>Tap Add.</li>
	</ol>
</ResponsiveModal>
