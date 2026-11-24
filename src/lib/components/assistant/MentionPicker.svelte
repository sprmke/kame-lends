<script lang="ts">
	import type { AssistantPinChip } from '$lib/assistant/store.svelte';
	import { Loader2, Search } from 'lucide-svelte';

	interface Props {
		query: string;
		typeFilter?: "borrower" | "investor" | "loan";
		onPick: (pin: AssistantPinChip) => void;
		onClose: () => void;
	}

	let { query, typeFilter, onPick, onClose }: Props = $props();
	let results = $state<AssistantPinChip[]>([]);
	let loading = $state(false);
	let active = $state(0);

	$effect(() => {
		const text = query.trim();
		const wantedType = typeFilter;
		if (!text && !wantedType) {
			results = [];
			return;
		}
		let cancelled = false;
		loading = true;
		const timer = setTimeout(async () => {
			try {
				const params = new URLSearchParams();
				if (text) params.set("q", text);
				if (wantedType) params.set("type", wantedType);
				const response = await fetch(`/api/ai/assistant/mentions?${params.toString()}`);
				if (!response.ok) return;
				const body = (await response.json()) as { pins?: AssistantPinChip[] };
				if (!cancelled) {
					results = body.pins ?? [];
					active = 0;
				}
			} catch {
				if (!cancelled) results = [];
			} finally {
				if (!cancelled) loading = false;
			}
		}, 160);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	function choose(index: number) {
		const pin = results[index];
		if (pin) onPick(pin);
	}

	/** Called from the composer textarea so arrow/Enter work without moving focus. */
	export function onKey(event: KeyboardEvent): boolean {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = Math.min(active + 1, Math.max(0, results.length - 1));
			return true;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
			return true;
		}
		if (event.key === 'Enter' && results.length > 0) {
			event.preventDefault();
			choose(active);
			return true;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return true;
		}
		return false;
	}
</script>

<div
	class="absolute inset-x-2 bottom-full z-30 mb-1.5 overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg"
	role="listbox"
	tabindex="-1"
	aria-label="Pin a borrower, investor, or loan"
	onkeydown={(event) => {
		onKey(event);
	}}
>
	<div class="flex items-center gap-1.5 border-b border-border/50 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
		{#if loading}<Loader2 class="size-3 animate-spin" />{:else}<Search class="size-3" />{/if}
		{loading ? 'Searching…' : results.length > 0 ? 'Pin to this question' : 'No match'}
	</div>
	{#if results.length > 0}
		<ul class="max-h-56 overflow-y-auto py-1">
			{#each results as pin, index (pin.type + String(pin.id))}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={index === active}
						class={[
							'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px]',
							index === active ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
						]}
						onmouseenter={() => (active = index)}
						onclick={() => onPick(pin)}
					>
						<span class="min-w-0 truncate font-medium">{pin.label}</span>
						<span class="shrink-0 text-[10px] text-muted-foreground">{pin.type}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
