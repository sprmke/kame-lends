<script lang="ts">
	import { resolveGroupColor } from '$lib/groups/group-colors';
	import { formatText } from '$lib/format';
	import { cn } from '$lib/utils';

	interface Props {
		name: string;
		color: string;
		size?: 'sm' | 'md';
		href?: string;
		class?: string;
		onclick?: (event: MouseEvent) => void;
	}

	let {
		name,
		color,
		size = 'sm',
		href,
		class: className,
		onclick
	}: Props = $props();

	const palette = $derived(resolveGroupColor(color));
	const label = $derived(formatText(name));

	const rootClass = $derived(
		cn(
			'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md font-medium',
			size === 'sm' && 'px-1.5 py-0.5 text-xs',
			size === 'md' && 'px-2 py-1 text-sm',
			palette.bg,
			palette.text,
			href && 'native-press transition-opacity hover:opacity-90',
			onclick && 'native-press cursor-pointer',
			className
		)
	);
</script>

{#if href}
	<a {href} data-sveltekit-preload-data="tap" class={rootClass} {onclick}>
		<span
			class={cn('size-2 shrink-0 rounded-full', palette.dot, size === 'md' && 'size-2.5')}
			aria-hidden="true"
		></span>
		<span class="truncate">{label}</span>
	</a>
{:else}
	<span
		class={rootClass}
		role={onclick ? 'button' : undefined}
		tabindex={onclick ? 0 : undefined}
		{onclick}
		onkeydown={(event) => {
			if (onclick && (event.key === 'Enter' || event.key === ' ')) {
				event.preventDefault();
				onclick(event as unknown as MouseEvent);
			}
		}}
	>
		<span
			class={cn('size-2 shrink-0 rounded-full', palette.dot, size === 'md' && 'size-2.5')}
			aria-hidden="true"
		></span>
		<span class="truncate">{label}</span>
	</span>
{/if}
