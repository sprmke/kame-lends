<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	interface Props {
		children: Snippet;
		class?: string;
		delay?: number;
		direction?: 'up' | 'down' | 'left' | 'right' | 'none';
	}

	let { children, class: className, delay = 0, direction = 'up' }: Props = $props();

	let isInView = $state(false);
	let node: HTMLDivElement | undefined = $state();

	const directionClasses = {
		up: 'translate-y-10',
		down: '-translate-y-10',
		left: 'translate-x-10',
		right: '-translate-x-10',
		none: ''
	};

	$effect(() => {
		if (!node) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) isInView = true;
			},
			{ threshold: 0.1 }
		);
		observer.observe(node);
		return () => observer.disconnect();
	});
</script>

<div
	bind:this={node}
	class={cn(
		'transition-all duration-700 ease-out will-change-transform',
		isInView
			? 'translate-x-0 translate-y-0 opacity-100'
			: cn('opacity-0', directionClasses[direction]),
		className
	)}
	style="transition-delay: {delay}ms"
>
	{@render children()}
</div>
