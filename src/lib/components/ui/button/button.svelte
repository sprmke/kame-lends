<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

	export const buttonVariants = tv({
		base: "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-transparent text-sm font-medium ring-offset-background transition-all duration-200 outline-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground shadow-[var(--shadow-soft)] hover:bg-primary/92 hover:shadow-[0_8px_28px_-6px_color-mix(in_oklch,var(--primary)_35%,transparent)]",
				outline:
					"border-border/50 bg-card surface-control hover:border-primary/30 hover:bg-muted/40 hover:text-foreground",
				secondary:
					"border border-border/50 bg-card text-muted-foreground surface-control hover:bg-muted/40",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				hero: "border-0 bg-white/15 text-white shadow-[0_0_0_1px_oklch(1_0_0/0.25)] hover:bg-white/25 hover:text-white [&_.lucide-chevron-down]:hidden",
				destructive:
					"bg-destructive text-destructive-foreground shadow-sm shadow-destructive/25 hover:bg-destructive/90 hover:shadow-md",
				link: "text-primary underline-offset-4 hover:underline",
				success:
					"bg-chart-2 text-white shadow-sm shadow-chart-2/25 hover:bg-chart-2/90 hover:shadow-md",
				warning:
					"bg-chart-5 text-white shadow-sm shadow-chart-5/25 hover:bg-chart-5/90 hover:shadow-md",
			},
			size: {
				default: "h-11 px-5 py-2",
				xs: "h-7 gap-1 rounded-lg px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
				sm: "h-11 rounded-xl px-3.5",
				lg: "h-12 rounded-xl px-8",
				icon: "h-11 w-11",
				"icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8 rounded-lg",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			/** Frosted icon well when rendered in the mobile brand header. */
			adaptToMobileHero?: boolean;
		};
</script>

<script lang="ts">
	import { createIsMobileShell } from "$lib/composables/use-media-query.svelte";

	let {
		class: className,
		variant = "default",
		size = "default",
		adaptToMobileHero = false,
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();

	const mobileShell = createIsMobileShell(
		adaptToMobileHero &&
			typeof window !== "undefined" &&
			window.matchMedia("(max-width: 1023px)").matches,
	);

	$effect(() => {
		if (!adaptToMobileHero) return;
		return mobileShell.init();
	});

	const useHero = $derived(adaptToMobileHero && mobileShell.matches);
	const resolvedVariant = $derived(useHero ? "hero" : variant);
	const resolvedSize = $derived(useHero ? "icon-sm" : size);
	const resolvedClass = $derived(
		useHero ? cn(className, "size-9 rounded-full p-0") : className
	);
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		data-size={resolvedSize}
		class={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize }), resolvedClass)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		data-size={resolvedSize}
		class={cn(buttonVariants({ variant: resolvedVariant, size: resolvedSize }), resolvedClass)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
