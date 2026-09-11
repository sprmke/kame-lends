<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { IconComponent } from '$lib/types/icon';

	interface Props {
		message: string;
		icon?: IconComponent;
		actions?: Snippet;
		children?: Snippet;
	}

	let { message, icon, actions, children }: Props = $props();
	const footerActions = $derived(actions ?? children);
</script>

<div class="empty-state-well gap-3 text-muted-foreground">
	{#if icon}
		{@const Icon = icon}
		<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
			<Icon class="h-5 w-5" />
		</div>
	{/if}
	<p class="text-sm">{message}</p>
	{#if footerActions}
		<div class="flex flex-wrap justify-center gap-2">
			{@render footerActions()}
		</div>
	{/if}
</div>
