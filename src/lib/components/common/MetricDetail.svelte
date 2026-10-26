<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { CircleHelp } from 'lucide-svelte';

	interface Props {
		label: string;
		detail: string;
	}

	let { label, detail }: Props = $props();
</script>

<Popover.Root>
	<span class="relative inline-flex size-8 shrink-0">
		<Popover.Trigger
			type="button"
			class="native-press absolute -inset-1.5 inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-muted"
			aria-label="About {label}"
			openOnHover
			openDelay={200}
			closeDelay={120}
		>
			<CircleHelp class="size-3.5" aria-hidden="true" />
		</Popover.Trigger>
	</span>
	<Popover.Content
		align="end"
		side="bottom"
		sideOffset={6}
		collisionPadding={{ top: 16, right: 16, bottom: 96, left: 16 }}
		class="w-[min(18rem,calc(100vw-2rem))] max-h-[min(40dvh,16rem)] overflow-y-auto p-3 text-left text-base leading-relaxed font-normal tracking-normal wrap-break-word text-pretty text-foreground normal-case"
	>
		<p>{detail}</p>
	</Popover.Content>
</Popover.Root>
