<script lang="ts">
	import { QUICK_TOOLS, type QuickTool } from '$lib/assistant/quick-tools';
	import { X } from 'lucide-svelte';

	interface Props {
		onPick: (tool: QuickTool) => void;
		onClose: () => void;
	}

	let { onPick, onClose }: Props = $props();

	const groups = $derived.by(() => {
		const map = new Map<string, QuickTool[]>();
		for (const tool of QUICK_TOOLS) {
			const list = map.get(tool.group) ?? [];
			list.push(tool);
			map.set(tool.group, list);
		}
		return [...map.entries()];
	});
</script>

<div data-testid="quick-tools-gallery" class="absolute inset-x-2 bottom-full z-20 mb-1.5 max-h-[60vh] overflow-y-auto rounded-xl border border-border/70 bg-popover p-3 shadow-lg">
	<div class="mb-2 flex items-center justify-between">
		<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Quick tools</p>
		<button
			type="button"
			class="native-press inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
			onclick={onClose}
			aria-label="Close quick tools"
		>
			<X class="size-3.5" />
		</button>
	</div>
	<div class="space-y-2.5">
		{#each groups as [group, tools]}
			<div>
				<p class="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">{group}</p>
				<div class="grid grid-cols-2 gap-1.5">
					{#each tools as tool (tool.id)}
						<button
							type="button"
							data-quick-tool={tool.id}
							class="native-press rounded-lg border border-border/60 bg-background px-2.5 py-2 text-left text-[11.5px] font-medium leading-snug hover:border-primary/50 hover:bg-primary/5"
							onclick={() => onPick(tool)}
						>
							{tool.label}
							{#if tool.requires}
								<span class="mt-0.5 block text-[9.5px] font-normal text-muted-foreground">needs a {tool.requires}</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
