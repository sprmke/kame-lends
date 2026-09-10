<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type"> &
			({ type: "file"; files?: FileList } | { type?: InputType; files?: undefined })
	>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		type,
		files = $bindable(),
		class: className,
		"data-slot": dataSlot = "input",
		...restProps
	}: Props = $props();
</script>

{#if type === "file"}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"flex h-11 w-full min-w-0 cursor-text rounded-2xl border border-border/50 bg-card px-4 py-2 text-sm outline-none transition-colors file:cursor-pointer file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground surface-control focus-visible:border-primary/40 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			className
		)}
		type="file"
		bind:files
		bind:value
		{...restProps}
	/>
{:else}
	<input
		bind:this={ref}
		data-slot={dataSlot}
		class={cn(
			"flex h-11 w-full min-w-0 cursor-text rounded-2xl border border-border/50 bg-card px-4 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground surface-control focus-visible:border-primary/40 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
			type === "number" &&
				"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
			className
		)}
		{type}
		onwheel={(event) => {
			if (type === "number") event.currentTarget.blur();
		}}
		bind:value
		{...restProps}
	/>
{/if}
