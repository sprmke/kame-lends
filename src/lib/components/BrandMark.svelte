<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		strokeWidth?: number;
	}

	let { class: className, strokeWidth = 2 }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={cn('shrink-0', className)}
	aria-hidden="true"
>
	<circle cx="9.25" cy="12" r="5.75" stroke="currentColor" stroke-width={strokeWidth} />
	<circle cx="14.75" cy="12" r="5.75" stroke="currentColor" stroke-width={strokeWidth} />
	<path
		d="M12 8.25v7.5"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
	/>
</svg>
