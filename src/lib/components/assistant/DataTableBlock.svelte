<script lang="ts">
	import type { TableColumn, TableRow } from '$lib/assistant/types';
	import { maskPrices } from '$lib/assistant/price';
	import { ArrowDown, ArrowUp, Check, Copy } from 'lucide-svelte';

	interface Props {
		title?: string;
		columns: TableColumn[];
		rows: TableRow[];
		note?: string;
		copyable?: boolean;
	}

	let { title, columns, rows, note, copyable = true }: Props = $props();
	let expanded = $state(false);
	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');
	let copied = $state(false);

	const visibleRows = $derived.by(() => {
		const sorted = [...rows];
		if (sortKey) {
			const key = sortKey;
			const dir = sortDir === 'asc' ? 1 : -1;
			sorted.sort((a, b) => {
				const left = a.cells[key];
				const right = b.cells[key];
				if (typeof left === 'number' && typeof right === 'number') return (left - right) * dir;
				return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true }) * dir;
			});
		}
		return expanded ? sorted : sorted.slice(0, 6);
	});

	function toggleSort(key: string) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	async function copyCsv() {
		const escape = (value: string | number | null) => {
			const text = maskPrices(String(value ?? ''));
			return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
		};
		const csv = [
			columns.map((column) => escape(column.label)).join(','),
			...rows.map((row) => columns.map((column) => escape(row.cells[column.key])).join(','))
		].join('\n');
		try {
			await navigator.clipboard.writeText(csv);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			// No clipboard; the table is still readable.
		}
	}
</script>

<div class="overflow-hidden rounded-xl border border-border/60">
	{#if title || copyable}
		<div class="flex items-center justify-between gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
			<p class="min-w-0 truncate text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
				{title ?? 'Details'}
			</p>
			{#if copyable && rows.length > 0}
				<button
					type="button"
					class="native-press inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
					onclick={() => void copyCsv()}
				>
					{#if copied}<Check class="size-3 text-emerald-600" />{:else}<Copy class="size-3" />{/if}
					{copied ? 'Copied' : 'CSV'}
				</button>
			{/if}
		</div>
	{/if}
	<div class="overflow-x-auto">
		<table class="w-full min-w-[22rem] border-collapse text-[12px]">
			<thead>
				<tr class="border-b border-border/40 bg-background/60">
					{#each columns as column (column.key)}
						<th
							class={[
								'whitespace-nowrap px-2.5 py-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase',
								column.align === 'right' ? 'text-right' : 'text-left'
							]}
							scope="col"
						>
							<button
								type="button"
								class="inline-flex items-center gap-1 hover:text-foreground"
								onclick={() => toggleSort(column.key)}
							>
								{column.label}
								{#if sortKey === column.key}
									{#if sortDir === 'asc'}<ArrowUp class="size-2.5" />{:else}<ArrowDown class="size-2.5" />{/if}
								{/if}
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each visibleRows as row, index (`${row.id ?? index}`)}
					<tr class="border-b border-border/25 last:border-0 hover:bg-muted/25">
						{#each columns as column (column.key)}
							<td
								class={[
									'px-2.5 py-2 align-top',
									column.align === 'right' ? 'text-right tabular-nums whitespace-nowrap' : 'text-left'
								]}
							>
								{#if index === 0 && row.href && column === columns[0]}
									<a class="font-medium underline decoration-border/70 underline-offset-2 hover:text-primary" href={row.href}>
										{maskPrices(String(row.cells[column.key] ?? '—'))}
									</a>
								{:else}
									{maskPrices(String(row.cells[column.key] ?? '—'))}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if rows.length > 6}
		<div class="border-t border-border/40 px-3 py-1.5">
			<button
				type="button"
				class="text-[11px] font-medium text-primary hover:underline"
				onclick={() => (expanded = !expanded)}
			>
				{expanded ? 'Show fewer' : `Show all ${rows.length}`}
			</button>
		</div>
	{:else if note}
		<p class="border-t border-border/40 px-3 py-1.5 text-[10.5px] text-muted-foreground">{note}</p>
	{/if}
</div>
