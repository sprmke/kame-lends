<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { getLoanStatusBadge } from '$lib/badge-config';
	import { formatText } from '$lib/format';
	import { cn } from '$lib/utils';
	import type { LoanStatus } from '$lib/types';

	interface Props {
		status: LoanStatus;
		class?: string;
	}

	let { status, class: className }: Props = $props();

	const badge = $derived(getLoanStatusBadge(status));
</script>

<Badge
	variant={badge.variant}
	class={cn(
		'shrink-0 px-1.5 py-0 text-[10px] leading-4 font-medium',
		badge.className,
		className
	)}
>
	{formatText(status)}
</Badge>
