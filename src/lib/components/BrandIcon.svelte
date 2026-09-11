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

	/** ~62% of the container, matching the mark-to-tile ratio of the app icon. */
	const markClasses: Record<Size, string> = {
		xs: 'size-[18px]',
		sm: 'size-5',
		md: 'size-[22px]',
		lg: 'size-6',
		xl: 'size-[27px]'
	};
</script>

<span
	class={cn(
		'inline-flex shrink-0 items-center justify-center',
		containerClasses[size],
		// Same gradient as static/brand/kame-lends-icon.svg (scripts/brand/generate-brand-assets.ts).
		variant === 'solid' &&
			'bg-[linear-gradient(135deg,#ffbf73_0%,#fb9f44_50%,#e4702a_100%)] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.28),var(--shadow-soft)]',
		variant === 'glass' && 'bg-white/15 text-primary-foreground',
		className
	)}
>
	<BrandMark class={markClasses[size]} />
</span>
