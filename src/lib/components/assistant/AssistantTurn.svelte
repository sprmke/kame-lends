<script lang="ts">
	import type { AssistantMessageDto, AssistantPhase, ToolStep } from '$lib/assistant/types';
	import { blocksToText } from '$lib/assistant/store.svelte';
	import { maskPrices } from '$lib/assistant/price';
	import MarkdownText from './MarkdownText.svelte';
	import AssistantBlocks from './AssistantBlocks.svelte';
	import TurnSteps from './TurnSteps.svelte';
	import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-svelte';

	interface Props {
		message: AssistantMessageDto;
		steps: ToolStep[];
		phase: AssistantPhase | null;
		streaming: boolean;
		canRegenerate?: boolean;
		onAsk: (message: string) => void;
		onFeedback: (messageId: string, value: 1 | -1) => void;
		onRegenerate: () => void;
	}

	let { message, steps, phase, streaming, canRegenerate = false, onAsk, onFeedback, onRegenerate }: Props = $props();
	let copied = $state(false);

	const stepList = $derived(steps.length > 0 ? steps : (message.toolTrace ?? []));

	async function copy() {
		const text = maskPrices(
			[message.text, blocksToText(message.blocks)].filter(Boolean).join('\n\n')
		);
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard denied.
		}
	}
</script>

<div class="space-y-2.5">
	{#if streaming || stepList.length > 0}
		<TurnSteps steps={stepList} {phase} {streaming} />
	{/if}

	{#if message.text}
		<div aria-live={streaming ? 'polite' : undefined}>
			<MarkdownText text={message.text} />
			{#if streaming}<span class="assistant-caret ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-primary align-middle"></span>{/if}
		</div>
	{/if}

	{#if message.blocks.length > 0}
		<AssistantBlocks blocks={message.blocks} {onAsk} />
	{/if}

	{#if !streaming && message.status === 'complete' && (message.text || message.blocks.length > 0)}
		<div class="flex items-center gap-0.5 pt-0.5">
			<button
				type="button"
				class="native-press inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
				aria-label="Copy answer"
				onclick={() => void copy()}
			>
				{#if copied}<Check class="size-3.5 text-emerald-600" />{:else}<Copy class="size-3.5" />{/if}
			</button>
			{#if canRegenerate}
				<button
					type="button"
					class="native-press inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label="Regenerate answer"
					onclick={onRegenerate}
				>
					<RefreshCw class="size-3.5" />
				</button>
			{/if}
			<button
				type="button"
				class={[
					'native-press inline-flex size-7 items-center justify-center rounded-md hover:bg-muted',
					message.feedback === 1 ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground'
				]}
				aria-label="Helpful"
				aria-pressed={message.feedback === 1}
				onclick={() => onFeedback(message.id, 1)}
			>
				<ThumbsUp class="size-3.5" />
			</button>
			<button
				type="button"
				class={[
					'native-press inline-flex size-7 items-center justify-center rounded-md hover:bg-muted',
					message.feedback === -1 ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
				]}
				aria-label="Not helpful"
				aria-pressed={message.feedback === -1}
				onclick={() => onFeedback(message.id, -1)}
			>
				<ThumbsDown class="size-3.5" />
			</button>
		</div>
	{/if}

	{#if message.status === 'error' && !message.text}
		<p class="text-[12px] text-destructive">That answer failed. Try again.</p>
	{:else if message.status === 'aborted'}
		<p class="text-[11.5px] italic text-muted-foreground">Stopped.</p>
	{/if}
</div>
