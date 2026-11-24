<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import { useAiStatus } from '$lib/ai-status.svelte';
	import { createIsMobileShell } from '$lib/composables/use-media-query.svelte';
	import { Sparkles } from 'lucide-svelte';

	type PanelProps = { variant?: 'panel' | 'page'; onClose?: () => void };

	const ai = useAiStatus();
	const mobile = createIsMobileShell(
		typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
	);
	let open = $state(false);
	let online = $state(true);
	let offlineNotice = $state(false);
	let Panel = $state<Component<PanelProps> | null>(null);

	$effect(() => mobile.init());

	$effect(() => {
		if (!open || Panel) return;
		void import('./AssistantPanel.svelte').then((module) => {
			Panel = module.default as Component<PanelProps>;
		});
	});

	onMount(() => {
		online = navigator.onLine;
		const onOnline = () => (online = true);
		const onOffline = () => (online = false);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	});

	$effect(() => {
		const root = document.documentElement;
		root.classList.toggle('assistant-docked', open && !mobile.matches);
		return () => root.classList.remove('assistant-docked');
	});

	function toggle() {
		if (!online) {
			offlineNotice = true;
			setTimeout(() => (offlineNotice = false), 4_000);
			return;
		}
		open = !open;
	}

	function onKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
			event.preventDefault();
			if (ai.assistantChat) toggle();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if ai.assistantChat}
	{#if offlineNotice}
		<div
			role="status"
			class="fixed right-3 bottom-[max(9.5rem,calc(var(--safe-area-bottom)+9rem))] z-50 max-w-[16rem] rounded-lg border border-border/70 bg-popover px-3 py-2 text-[11.5px] leading-snug text-muted-foreground shadow-lg lg:right-5 lg:bottom-[5.5rem]"
		>
			You are offline. The assistant needs a connection.
		</div>
	{/if}
	{#if !open}
		<button
			type="button"
			class="assistant-launcher native-press fixed right-3 bottom-[max(5.75rem,calc(var(--safe-area-bottom)+5.25rem))] z-40 inline-flex h-11 items-center gap-1.5 rounded-full border border-primary/25 bg-primary px-4 text-[12.5px] font-semibold text-primary-ink shadow-[var(--shadow-elevated-lg)] transition-transform hover:scale-[1.02] active:scale-[0.98] lg:right-5 lg:bottom-5"
			onclick={toggle}
			aria-label="Ask Kame"
		>
			<Sparkles class="size-4" />
			Ask
			{#if !online}<span class="size-1.5 rounded-full bg-background/70"></span>{/if}
		</button>
	{/if}

	{#if open && mobile.matches}
		<Sheet.Root bind:open>
			<Sheet.Content side="bottom" showCloseButton={false} class="h-[92dvh] gap-0 overflow-hidden p-0">
				<Sheet.Header class="sr-only">
					<Sheet.Title>Ask Kame</Sheet.Title>
				</Sheet.Header>
				<div class="flex min-h-0 flex-1 flex-col pt-1">
					{#if !online}
						<div class="mx-3 mb-1 rounded-lg bg-muted px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
							You are offline. The assistant needs a connection.
						</div>
					{/if}
					<div class="min-h-0 flex-1">
						{#if Panel}
							<Panel variant="panel" onClose={() => (open = false)} />
						{:else}
							<div class="flex h-full items-center justify-center">
								<div class="size-6 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
							</div>
						{/if}
					</div>
				</div>
			</Sheet.Content>
		</Sheet.Root>
	{:else if open}
		<aside
			class="assistant-panel fixed top-4 right-4 bottom-4 z-40 flex w-[26rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[var(--shadow-elevated-lg)]"
			aria-label="Ask Kame"
		>
			{#if Panel}
				<Panel variant="panel" onClose={() => (open = false)} />
			{:else}
				<div class="flex h-full items-center justify-center">
					<div class="size-6 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
				</div>
			{/if}
		</aside>
	{/if}
{/if}
