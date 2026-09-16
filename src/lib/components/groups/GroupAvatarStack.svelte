<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatText } from '$lib/format';

	interface Props {
		initials: string[];
		max?: number;
		size?: 'sm' | 'md';
		/** Hide from assistive tech when a visible name is already adjacent. */
		decorative?: boolean;
		class?: string;
	}

	let { initials, max = 4, size = 'sm', decorative = false, class: className }: Props = $props();

	function clipInitials(value: string): string {
		const trimmed = value.trim();
		if (!trimmed) return '?';
		const parts = trimmed.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
		}
		return trimmed.slice(0, 2).toUpperCase();
	}

	const visible = $derived(initials.slice(0, max));
	const overflow = $derived(Math.max(0, initials.length - max));

	const avatarClass = $derived(
		cn(
			'flex items-center justify-center rounded-full border-2 border-background bg-muted font-semibold text-muted-foreground',
			size === 'sm' && 'size-7 text-[10px]',
			size === 'md' && 'size-8 text-xs'
		)
	);
</script>

<div
	class={cn('flex items-center', className)}
	aria-hidden={decorative ? true : undefined}
	aria-label={decorative ? undefined : `${initials.length} people`}
>
	{#each visible as initial, index (index)}
		<span
			class={cn(avatarClass, index > 0 && '-ml-2')}
			title={formatText(initial)}
		>
			{clipInitials(initial)}
		</span>
	{/each}
	{#if overflow > 0}
		<span class={cn(avatarClass, visible.length > 0 && '-ml-2')} aria-label="{overflow} more">
			+{overflow}
		</span>
	{/if}
</div>
