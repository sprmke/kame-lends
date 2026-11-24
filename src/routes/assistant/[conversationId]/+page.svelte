<script lang="ts">
	import AssistantPanel from '$lib/components/assistant/AssistantPanel.svelte';
	import { page } from '$app/state';

	const conversationId = $derived(page.params.conversationId ?? null);
</script>

<svelte:head>
	<title>Ask Kame</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-5xl flex-col px-2 pt-2 lg:px-4 lg:pt-0">
	<div class="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
		<AssistantPanel variant="page" initialConversationId={conversationId} />
	</div>
</div>
