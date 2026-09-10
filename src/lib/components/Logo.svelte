<script lang="ts">
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import { APP_NAME } from '$lib/brand';
	import { cn } from '$lib/utils';

	type Size = 'sm' | 'md' | 'lg' | 'xl';

	interface Props {
		size?: Size;
		showIcon?: boolean;
		gradient?: boolean;
		animated?: boolean;
		/** Tighter icon container for dashboard chrome */
		compactIcon?: boolean;
		class?: string;
	}

	let {
		size = 'md',
		showIcon = false,
		gradient = false,
		animated = false,
		compactIcon = false,
		class: className
	}: Props = $props();

	const [brandPrimary, brandAccent] = APP_NAME.split(' ');

	const sizeClasses: Record<Size, string> = {
		sm: 'text-base',
		md: 'text-lg',
		lg: 'text-xl',
		xl: 'text-2xl'
	};

	const iconSizeMap: Record<Size, 'xs' | 'sm' | 'md' | 'lg' | 'xl'> = {
		sm: 'xs',
		md: compactIcon ? 'sm' : 'md',
		lg: 'lg',
		xl: 'xl'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-2.5 font-semibold tracking-tight text-foreground',
		sizeClasses[size],
		animated && 'transition-opacity duration-200 hover:opacity-90',
		className
	)}
>
	{#if showIcon}
		<BrandIcon
			size={iconSizeMap[size]}
			class={cn(gradient && 'ring-1 ring-primary/15')}
		/>
	{/if}
	<span class="leading-none">
		{brandPrimary}{#if brandAccent}<span class="text-primary"> {brandAccent}</span>{/if}
	</span>
</span>
