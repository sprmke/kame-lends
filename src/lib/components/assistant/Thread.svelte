<script lang="ts">
	import type {
		AssistantConversationDto,
		AssistantMessageDto,
		AssistantPhase,
		ToolStep
	} from '$lib/assistant/types';
	import { starterPrompts } from '$lib/assistant/quick-tools';
	import MarkdownText from './MarkdownText.svelte';
	import AssistantTurn from './AssistantTurn.svelte';
	import { Sparkles } from 'lucide-svelte';

	interface Props {
		messages: AssistantMessageDto[];
		steps: ToolStep[];
		phase: AssistantPhase | null;
		streaming: boolean;
		loading: boolean;
		error: { code: string; message: string } | null;
		page: string | null;
		isOwner: boolean;
		onAsk: (message: string) => void;
		onFeedback: (messageId: string, value: 1 | -1) => void;
		onRegenerate: () => void;
	}

	let {
		messages,
		steps,
		phase,
		streaming,
		loading,
		error,
		page,
		isOwner,
		onAsk,
		onFeedback,
		onRegenerate
	}: Props = $props();

	let scroller = $state<HTMLDivElement | null>(null);

	const starters = $derived(starterPrompts({ page, isOwner }));
	const lastSignature = $derived(
		`${messages.length}:${messages.at(-1)?.text.length ?? 0}:${messages.at(-1)?.blocks.length ?? 0}`
	);

	$effect(() => {
		void lastSignature;
		if (!scroller) return;
		const nearBottom =
			scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 180;
		if (nearBottom || streaming) {
			requestAnimationFrame(() => {
				scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
			});
		}
	});

	$effect(() => {
		if (!loading && scroller && messages.length > 0) {
			requestAnimationFrame(() => {
				scroller?.scrollTo({ top: scroller.scrollHeight });
			});
		}
	});
</script>

<div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
	{#if messages.length === 0 && !loading}
		<div class="flex h-full flex-col items-center justify-center px-2 py-8 text-center">
			<div class="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
				<Sparkles class="size-5" />
			</div>
			<p class="mt-3 text-[15px] font-semibold tracking-tight">Ask about your lending data</p>
			<p class="mt-1 max-w-[16rem] text-[11.5px] leading-snug text-muted-foreground">
				Balances, dues, interest, and payments, with the math shown.
			</p>
			<div class="mt-4 grid w-full max-w-[19rem] grid-cols-1 gap-1.5">
				{#each starters as starter}
					<button
						type="button"
						class="native-press rounded-lg border border-border/60 bg-card px-3 py-2 text-left text-[12px] font-medium hover:border-primary/40 hover:bg-primary/[0.03]"
						onclick={() => onAsk(starter.prompt)}
					>
						{starter.label}
					</button>
				{/each}
			</div>
			<p class="mt-4 text-[10px] leading-snug text-muted-foreground">
				Reads only what you can already see. Never changes anything.
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#if loading}
				<div class="space-y-2 py-2">
					<div class="h-3 w-1/3 animate-pulse rounded bg-muted"></div>
					<div class="h-12 w-full animate-pulse rounded-xl bg-muted/60"></div>
					<div class="h-3 w-1/2 animate-pulse rounded bg-muted"></div>
				</div>
			{/if}
			{#if error && !streaming}
				<div class="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
					{error.message}
				</div>
			{/if}
			{#each messages as message, index (message.id)}
				{#if message.role === 'user'}
					<div class="flex justify-end">
						<div class="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-ink">
							<MarkdownText text={message.text} class="text-primary-ink" />
						</div>
					</div>
				{:else}
					<div class="flex gap-2">
						<div class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<Sparkles class="size-3" />
						</div>
						<div class="min-w-0 flex-1">
							<AssistantTurn
								{message}
								steps={index === messages.length - 1 ? steps : (message.toolTrace ?? [])}
								phase={index === messages.length - 1 ? phase : null}
								streaming={streaming && index === messages.length - 1}
								canRegenerate={!streaming && index === messages.length - 1}
								{onAsk}
								{onFeedback}
								onRegenerate={onRegenerate}
							/>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
