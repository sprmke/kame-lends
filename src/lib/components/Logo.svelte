<script lang="ts">
	import { APP_NAME } from '$lib/brand';
	import { cn } from '$lib/utils';
	import { Landmark } from 'lucide-svelte';

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

	const iconSizeClasses: Record<Size, string> = {
		sm: 'h-4 w-4',
		md: 'h-5 w-5',
		lg: 'h-6 w-6',
		xl: 'h-7 w-7'
	};

	const iconContainerClasses: Record<Size, string> = {
		sm: 'h-8 w-8 rounded-xl',
		md: 'h-9 w-9 rounded-xl',
		lg: 'h-10 w-10 rounded-2xl',
		xl: 'h-11 w-11 rounded-2xl'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-2.5 font-extrabold tracking-tight text-foreground',
		sizeClasses[size],
		animated && 'transition-all duration-300',
		className
	)}
>
	{#if showIcon}
		<span
			class={cn(
				'inline-flex items-center justify-center bg-gradient-to-br from-primary to-chart-5',
				compactIcon ? 'rounded-md shadow-none' : 'shadow-[var(--shadow-soft)]',
				compactIcon
					? size === 'sm'
						? 'h-7 w-7'
						: size === 'md'
							? 'h-8 w-8'
							: iconContainerClasses[size]
					: iconContainerClasses[size]
			)}
		>
			<Landmark class={cn('text-primary-foreground', iconSizeClasses[size])} />
		</span>
	{/if}
	<span>
		{brandPrimary}{#if brandAccent}<span class="text-primary"> {brandAccent}</span>{/if}
	</span>
</span>
