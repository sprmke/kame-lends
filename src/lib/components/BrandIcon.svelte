<script lang="ts">
	import BrandMark from '$lib/components/BrandMark.svelte';
	import { cn } from '$lib/utils';

	type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

	interface Props {
		size?: Size;
		variant?: 'solid' | 'glass';
		class?: string;
	}

	let { size = 'md', variant = 'solid', class: className }: Props = $props();

	const containerClasses: Record<Size, string> = {
		xs: 'h-7 w-7 rounded-lg',
		sm: 'h-8 w-8 rounded-xl',
		md: 'h-9 w-9 rounded-xl',
		lg: 'h-10 w-10 rounded-2xl',
		xl: 'h-11 w-11 rounded-2xl'
	};

	const markClasses: Record<Size, string> = {
		xs: 'h-3.5 w-3.5',
		sm: 'h-4 w-4',
		md: 'h-[18px] w-[18px]',
		lg: 'h-5 w-5',
		xl: 'h-6 w-6'
	};
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center justify-center',
		containerClasses[size],
		variant === 'solid' && 'bg-primary text-primary-foreground shadow-[var(--shadow-soft)]',
		variant === 'glass' && 'bg-white/15 text-primary-foreground',
		className
	)}
>
	<BrandMark class={markClasses[size]} strokeWidth={size === 'xs' || size === 'sm' ? 1.85 : 2} />
</span>
