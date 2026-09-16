<script lang="ts">
	import {
		GROUP_COLOR_KEYS,
		resolveGroupColor,
		type GroupColorKey
	} from '$lib/groups/group-colors';
	import { cn } from '$lib/utils';

	interface Props {
		value: GroupColorKey;
		onValueChange: (value: GroupColorKey) => void;
		disabled?: boolean;
		class?: string;
	}

	let { value, onValueChange, disabled = false, class: className }: Props = $props();
</script>

<div
	class={cn('flex flex-wrap items-center gap-2', className)}
	role="radiogroup"
	aria-label="Group color"
>
	{#each GROUP_COLOR_KEYS as key (key)}
		{@const palette = resolveGroupColor(key)}
		<button
			type="button"
			role="radio"
			aria-checked={value === key}
			aria-label={key}
			disabled={disabled}
			class={cn(
				'touch-hit size-7 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
				palette.dot,
				value === key && 'ring-1 ring-foreground ring-offset-1 ring-offset-background'
			)}
			onclick={() => onValueChange(key)}
		></button>
	{/each}
</div>
