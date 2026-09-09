<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Search, X } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		value: string;
		onChange: (value: string) => void;
		placeholder?: string;
		class?: string;
	}

	let { value, onChange, placeholder = 'Search...', class: className = '' }: Props = $props();
</script>

<div class={cn('relative flex-1', className)}>
	<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
	<Input
		{placeholder}
		{value}
		oninput={(e) => onChange(e.currentTarget.value)}
		class="h-11 rounded-xl border-border/50 bg-muted/40 pr-11 pl-10 shadow-none focus-visible:bg-background"
	/>
	{#if value}
		<button
			type="button"
			onclick={() => onChange('')}
			class="touch-target absolute top-1/2 right-1 flex -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
			aria-label="Clear search"
		>
			<X class="h-4 w-4" />
		</button>
	{/if}
</div>
