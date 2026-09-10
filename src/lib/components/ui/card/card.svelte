<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		size = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { size?: "default" | "sm" } = $props();
</script>

<div
	bind:this={ref}
	data-slot="card"
	data-size={size}
	class={cn("group/card flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card text-sm text-card-foreground shadow-[var(--shadow-elevated)] [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-3xl *:[img:last-child]:rounded-b-3xl", className)}
	{...restProps}
>
	{@render children?.()}
</div>
