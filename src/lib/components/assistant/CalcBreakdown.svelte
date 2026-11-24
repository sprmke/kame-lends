<script lang="ts">
	import type { CalcTrace } from '$lib/assistant/types';
	import { maskPrices } from '$lib/assistant/price';
	import { formatPHP } from '$lib/money/centavos';
	import { Check, Copy } from 'lucide-svelte';

	interface Props {
		trace: CalcTrace;
	}

	let { trace }: Props = $props();
	let copied = $state(false);
	let open = $state(false);

	const title = $derived(maskPrices(trace.title));
	const total = $derived(maskPrices(trace.totalDisplay ?? ''));
	const groups = $derived(
		trace.groups.map((group) => ({
			...group,
			subtotal: maskPrices(group.subtotalDisplay ?? ''),
			lines: group.lines.map((line) => ({
				...line,
				label: maskPrices(line.label),
				display: maskPrices(line.display),
				note: line.note ? maskPrices(line.note) : undefined
			}))
		}))
	);

	async function copyText() {
		const text = [
			title,
			`As of ${trace.asOf}`,
			trace.definition,
			'',
			...groups.flatMap((group) => [
				group.label,
				...group.lines.map((line) => `  ${line.label}: ${line.display}${line.note ? ` (${line.note})` : ''}`),
				group.subtotal ? `  Subtotal: ${group.subtotal}` : ''
			]),
			total ? `Total: ${total}` : '',
			...(trace.caveats ?? []).map((caveat) => `Note: ${caveat}`)
		]
			.filter(Boolean)
			.join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// Clipboard permission denied; the table stays readable.
		}
	}
</script>

<div class="rounded-xl border border-border/60 bg-muted/20">
	<div class="flex items-center gap-1 px-3 py-2.5">
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-medium text-foreground"
			aria-expanded={open}
			onclick={() => (open = !open)}
		>
			<span
				class="text-muted-foreground transition-transform"
				class:rotate-90={open}
				aria-hidden="true">▸</span
			>
			<span class="shrink-0">How I calculated this</span>
			<span class="truncate text-muted-foreground">· {title}</span>
		</button>
		<button
			type="button"
			class="native-press inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label="Copy calculation"
			onclick={() => void copyText()}
		>
			{#if copied}<Check class="size-3.5 text-emerald-600" />{:else}<Copy class="size-3.5" />{/if}
		</button>
	</div>
	{#if open}
	<div class="space-y-3 border-t border-border/50 px-3 py-3">
		<p class="text-[11.5px] leading-snug text-muted-foreground">{trace.definition}</p>
		{#each groups as group}
			<div class="space-y-1.5">
				<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</p>
				<div class="space-y-1">
					{#each group.lines as line}
						<div class="flex items-start justify-between gap-3 text-[12px]">
							<div class="min-w-0">
								{#if line.source?.href}
									<a class="underline decoration-border underline-offset-2 hover:text-primary" href={line.source.href}>
										{line.label}
									</a>
								{:else}
									<span>{line.label}</span>
								{/if}
								{#if line.note}<span class="block text-[10.5px] leading-snug text-muted-foreground">{line.note}</span>{/if}
							</div>
							<span class="shrink-0 tabular-nums">{line.display}</span>
						</div>
					{/each}
				</div>
				{#if group.subtotal}
					<div class="flex justify-between border-t border-border/40 pt-1.5 text-[12px] font-semibold">
						<span>Subtotal</span><span class="tabular-nums">{group.subtotal}</span>
					</div>
				{/if}
			</div>
		{/each}
		{#if total}
			<div class="flex justify-between border-t border-border/60 pt-2 text-[13px] font-semibold">
				<span>Total</span><span class="tabular-nums">{total}</span>
			</div>
		{/if}
		{#if trace.caveats?.length}
			<ul class="space-y-1 pt-1">
				{#each trace.caveats as caveat}
					<li class="text-[11px] leading-snug text-amber-700 dark:text-amber-400">• {caveat}</li>
				{/each}
			</ul>
		{/if}
		<p class="text-[10.5px] text-muted-foreground">As of {trace.asOf}. Rounded once per period, half-up.</p>
	</div>
	{/if}
</div>
