<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3",
		variants: {
			variant: {
				default: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
				secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
				outline: "text-foreground",
				ghost: "border-transparent hover:bg-muted hover:text-muted-foreground",
				link: "border-transparent text-primary underline-offset-4 hover:underline",
				success: "border-transparent bg-chart-2/12 text-chart-2 hover:bg-chart-2/20",
				warning: "border-transparent bg-chart-5/12 text-chart-5 hover:bg-chart-5/20",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), href && 'cursor-pointer', className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
