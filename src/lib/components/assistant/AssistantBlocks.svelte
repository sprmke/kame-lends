<script lang="ts">
	import type { AssistantBlock, SourceRef } from '$lib/assistant/types';
	import { maskPrices } from '$lib/assistant/price';
	import MarkdownText from './MarkdownText.svelte';
	import CalcBreakdown from './CalcBreakdown.svelte';
	import DataTableBlock from './DataTableBlock.svelte';
	import ChartBlock from './ChartBlock.svelte';
	import { ArrowUpRight, Info, TriangleAlert } from 'lucide-svelte';

	interface Props {
		blocks: AssistantBlock[];
		onAsk?: (message: string) => void;
	}

	let { blocks, onAsk }: Props = $props();

	const SOURCE_LABEL: Record<SourceRef['type'], string> = {
		loan: 'Loan',
		borrower: 'Borrower',
		investor: 'Investor',
		witness: 'Witness',
		debt: 'Bank loan',
		group: 'Group',
		payment: 'Payment',
		period: 'Period',
		help: 'Help'
	};
</script>

<div class="space-y-3">
	{#each blocks as block}
		{#if block.type === 'text'}
			<MarkdownText text={block.markdown} />
		{:else if block.type === 'stat_list'}
			<div class="grid grid-cols-2 gap-2">
				{#each block.stats as stat}
					<div
						class={[
							'rounded-xl border border-border/55 bg-card px-3 py-2.5',
							stat.tone === 'warning' ? 'border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/15' : '',
							stat.tone === 'positive' ? 'border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10' : ''
						]}
					>
						<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
							{maskPrices(stat.label)}
						</p>
						<p class="mt-0.5 text-[15px] font-semibold tabular-nums">{maskPrices(stat.value)}</p>
						{#if stat.hint}<p class="mt-0.5 text-[10.5px] text-muted-foreground">{maskPrices(stat.hint)}</p>{/if}
					</div>
				{/each}
			</div>
		{:else if block.type === 'data_table'}
			<DataTableBlock
				title={block.title}
				columns={block.columns}
				rows={block.rows}
				note={block.note}
				copyable={block.copyable}
			/>
		{:else if block.type === 'chart'}
			<ChartBlock title={block.title} points={block.points} note={block.note} />
		{:else if block.type === 'calc_breakdown'}
			<CalcBreakdown trace={block.trace} />
		{:else if block.type === 'entity_card'}
			<a
				href={block.href}
				class="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
			>
				<div class="min-w-0">
					<p class="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
						{SOURCE_LABEL[block.entityType]}
					</p>
					<p class="truncate text-[13px] font-semibold">{block.title}</p>
					{#if block.subtitle}<p class="truncate text-[11px] text-muted-foreground">{block.subtitle}</p>{/if}
					{#if block.stats?.length}
						<p class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
							{#each block.stats as stat}
								<span class="text-[10.5px] text-muted-foreground"
									>{maskPrices(stat.label)}: <span class="font-medium text-foreground tabular-nums"
										>{maskPrices(stat.value)}</span
									></span
								>
							{/each}
						</p>
					{/if}
				</div>
				<ArrowUpRight class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
			</a>
		{:else if block.type === 'callout'}
			<div
				class={[
					'flex gap-2 rounded-xl border px-3 py-2.5 text-[11.5px] leading-snug',
					block.tone === 'warn'
						? 'border-amber-500/30 bg-amber-50/50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200'
						: 'border-border/60 bg-muted/30 text-muted-foreground'
				]}
			>
				{#if block.tone === 'warn'}
					<TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
				{:else}
					<Info class="mt-0.5 size-3.5 shrink-0" />
				{/if}
				<div>
					{#if block.title}<p class="font-semibold">{block.title}</p>{/if}
					<p>{maskPrices(block.text)}</p>
				</div>
			</div>
		{:else if block.type === 'choice'}
			<div class="rounded-xl border border-border/60 bg-card p-3">
				<p class="text-[12.5px] font-medium">{block.prompt}</p>
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each block.options as option}
						<button
							type="button"
							class="native-press rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-left text-[11.5px] font-medium hover:border-primary/50 hover:bg-primary/5"
							onclick={() => onAsk?.(option.value)}
						>
							{option.label}
							{#if option.hint}<span class="block text-[10px] font-normal text-muted-foreground">{option.hint}</span>{/if}
						</button>
					{/each}
				</div>
			</div>
		{:else if block.type === 'quick_actions'}
			<div class="flex flex-wrap gap-1.5">
				{#each block.actions as action}
					{#if action.href}
						<a
							href={action.href}
							class="native-press inline-flex min-h-8 items-center gap-1 rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-medium hover:border-primary/50 hover:bg-primary/5"
						>
							{action.label}
							<ArrowUpRight class="size-3" />
						</a>
					{:else}
						<button
							type="button"
							class="native-press inline-flex min-h-8 items-center rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-medium hover:border-primary/50 hover:bg-primary/5"
							onclick={() => onAsk?.(action.message ?? action.label)}
						>
							{action.label}
						</button>
					{/if}
				{/each}
			</div>
		{:else if block.type === 'source_chips'}
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-[10.5px] font-medium text-muted-foreground">Based on</span>
				{#each block.sources as source}
					{#if source.href}
						<a
							href={source.href}
							class="inline-flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-muted/70 px-2 py-0.5 text-[10.5px] font-medium text-foreground hover:bg-primary/10 hover:text-primary"
						>
							<span class="text-muted-foreground">{SOURCE_LABEL[source.type]}</span>
							<span class="truncate">{maskPrices(source.label ?? String(source.id))}</span>
						</a>
					{:else}
						<span class="inline-flex items-center rounded-full bg-muted/70 px-2 py-0.5 text-[10.5px]">
							{maskPrices(source.label ?? String(source.id))}
						</span>
					{/if}
				{/each}
			</div>
		{:else if block.type === 'refusal'}
			<div class="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-[12px] text-muted-foreground">
				{maskPrices(block.text)}
			</div>
		{:else if block.type === 'error_hint'}
			<div class="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-[11.5px] text-destructive">
				{maskPrices(block.text)}
			</div>
		{/if}
	{/each}
</div>
