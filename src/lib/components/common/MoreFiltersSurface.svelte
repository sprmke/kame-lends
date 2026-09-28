<script lang="ts">
	import type { Snippet } from 'svelte';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		children: Snippet;
	}

	let { open, onOpenChange, children }: Props = $props();

	const mobileShell = createIsMobileShell(false);

	$effect(() => {
		mobileShell.init();
	});

	const sheetOpen = $derived(open && mobileShell.matches);
</script>

{#if open && !mobileShell.matches}
	<div class="dashboard-filter-panel animate-in duration-200 slide-in-from-top-2">
		{@render children()}
	</div>
{/if}

<ResponsiveModal
	open={sheetOpen}
	onOpenChange={onOpenChange}
	title="Filters"
	bodyClass="py-2"
>
	<div class="dashboard-filter-panel !border-0 !bg-transparent !p-0 !shadow-none">
		{@render children()}
	</div>
	{#snippet footer()}
		<Button
			type="button"
			class="min-h-11 w-full touch-target"
			onclick={() => onOpenChange(false)}
		>
			Done
		</Button>
	{/snippet}
</ResponsiveModal>
