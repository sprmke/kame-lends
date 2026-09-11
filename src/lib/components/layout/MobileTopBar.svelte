<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import BrandIcon from '$lib/components/BrandIcon.svelte';
	import { APP_NAME } from '$lib/brand';

	interface Props {
		actions?: Snippet;
		class?: string;
	}

	let { actions, class: className = '' }: Props = $props();

	const [brandPrimary, brandAccent] = APP_NAME.split(' ');
</script>

<header
	class={cn('mobile-brand-hero fixed inset-x-0 top-0 z-40 pt-safe lg:hidden', className)}
	style="padding-left: var(--safe-area-left); padding-right: var(--safe-area-right);"
>
	<div class="flex h-[var(--mobile-top-bar-height)] items-center gap-2 px-3">
		<a
			href="/dashboard"
			class="native-press flex min-w-0 flex-1 items-center gap-2"
			aria-label={APP_NAME}
		>
			<BrandIcon size="sm" variant="glass" />
			<span
				class="min-w-0 truncate text-[15px] font-semibold tracking-tight text-primary-foreground"
			>
				{brandPrimary}{#if brandAccent}<span class="font-semibold text-primary-foreground/80"
					>&nbsp;{brandAccent}</span
				>{/if}
			</span>
		</a>
		{#if actions}
			{@render actions()}
		{/if}
	</div>
</header>
