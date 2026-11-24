<script lang="ts">
	import type { AssistantPhase, ToolStep } from '$lib/assistant/types';
	import { Check, ChevronDown, Loader2, X } from 'lucide-svelte';

	interface Props {
		steps: ToolStep[];
		phase: AssistantPhase | null;
		streaming: boolean;
	}

	let { steps, phase, streaming }: Props = $props();
	let expanded = $state(false);

	const totalMs = $derived(steps.reduce((sum, step) => sum + (step.ms || 0), 0));
	const open = $derived(streaming || expanded);

	const phaseLabel = $derived(
		phase === 'understanding'
			? 'Understanding the question'
			: phase === 'looking_up'
				? 'Looking up records'
				: phase === 'computing'
					? 'Computing'
					: phase === 'writing'
						? 'Writing the answer'
						: phase === 'checking'
							? 'Checking the numbers'
							: 'Thinking'
	);
</script>

{#if steps.length > 0 || streaming}
	<div class="space-y-1.5">
		<button
			type="button"
			class="flex w-full items-center gap-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
			onclick={() => (expanded = !expanded)}
			aria-expanded={open}
		>
			{#if streaming}
				<Loader2 class="size-3 animate-spin text-primary" />
				<span>{phaseLabel}…</span>
			{:else}
				<Check class="size-3 text-emerald-600" />
				<span>Worked for {(totalMs / 1000).toFixed(1)} s · {steps.length} step{steps.length === 1 ? '' : 's'}</span>
				<ChevronDown class={open ? 'size-3 rotate-180 transition-transform' : 'size-3 transition-transform'} />
			{/if}
		</button>
		{#if open}
			<ul class="space-y-1 pl-0.5" aria-label="Working steps">
				{#each steps as step (step.id)}
					<li class="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
						{#if step.ok}
							<Check class="size-2.5 shrink-0 text-emerald-600" />
						{:else}
							<X class="size-2.5 shrink-0 text-destructive" />
						{/if}
						<span class="min-w-0 truncate">{step.label}</span>
						{#if step.reason}<span class="truncate text-destructive/80">· {step.reason}</span>{/if}
						{#if step.ms > 0}
							<span class="ml-auto shrink-0 tabular-nums">{(step.ms / 1000).toFixed(1)} s</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
