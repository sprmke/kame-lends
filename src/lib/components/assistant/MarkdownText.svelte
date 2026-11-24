<script lang="ts">
	import { maskPrices } from '$lib/assistant/price';

	interface Props {
		text: string;
		class?: string;
	}

	let { text, class: className = '' }: Props = $props();

	type Block =
		| { kind: 'heading'; level: number; text: string }
		| { kind: 'bullet'; text: string }
		| { kind: 'number'; marker: string; text: string }
		| { kind: 'paragraph'; text: string };

	const blocks = $derived.by<Block[]>(() => {
		const lines = maskPrices(text).replace(/\r\n/g, '\n').split('\n');
		const result: Block[] = [];
		for (const raw of lines) {
			const line = raw.trimEnd();
			if (!line.trim()) continue;
			const heading = /^(#{1,4})\s+(.*)$/.exec(line);
			if (heading) {
				result.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
				continue;
			}
			const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
			if (bullet) {
				result.push({ kind: 'bullet', text: bullet[1] });
				continue;
			}
			const numbered = /^\s*(\d+[.)])\s+(.*)$/.exec(line);
			if (numbered) {
				result.push({ kind: 'number', marker: numbered[1], text: numbered[2] });
				continue;
			}
			result.push({ kind: 'paragraph', text: line });
		}
		return result;
	});

	type Inline = { type: 'text' | 'bold' | 'code'; value: string };

	function inline(value: string): Inline[] {
		const parts: Inline[] = [];
		const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
		let last = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(value))) {
			if (match.index > last) {
				parts.push({ type: 'text', value: value.slice(last, match.index) });
			}
			const token = match[0];
			if (token.startsWith('**')) {
				parts.push({ type: 'bold', value: token.slice(2, -2) });
			} else {
				parts.push({ type: 'code', value: token.slice(1, -1) });
			}
			last = match.index + token.length;
		}
		if (last < value.length) parts.push({ type: 'text', value: value.slice(last) });
		return parts;
	}
</script>

<div class={['assistant-markdown space-y-2 text-[13.5px] leading-relaxed', className]}>
	{#each blocks as block}
		{#if block.kind === 'heading'}
			<p class="pt-1 text-[13px] font-semibold tracking-tight text-foreground">
				{#each inline(block.text) as part}
					{#if part.type === 'bold'}<strong>{part.value}</strong
						>{:else if part.type === 'code'}<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]"
							>{part.value}</code
						>{:else}{part.value}{/if}
				{/each}
			</p>
		{:else if block.kind === 'bullet'}
			<div class="flex gap-2">
				<span class="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true"></span>
				<p class="min-w-0">
					{#each inline(block.text) as part}
						{#if part.type === 'bold'}<strong>{part.value}</strong
							>{:else if part.type === 'code'}<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]"
								>{part.value}</code
							>{:else}{part.value}{/if}
					{/each}
				</p>
			</div>
		{:else if block.kind === 'number'}
			<div class="flex gap-2">
				<span class="w-4 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground"
					>{block.marker}</span
				>
				<p class="min-w-0">
					{#each inline(block.text) as part}
						{#if part.type === 'bold'}<strong>{part.value}</strong
							>{:else if part.type === 'code'}<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]"
								>{part.value}</code
							>{:else}{part.value}{/if}
					{/each}
				</p>
			</div>
		{:else}
			<p>
				{#each inline(block.text) as part}
					{#if part.type === 'bold'}<strong>{part.value}</strong
						>{:else if part.type === 'code'}<code class="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]"
							>{part.value}</code
						>{:else}{part.value}{/if}
				{/each}
			</p>
		{/if}
	{/each}
</div>
