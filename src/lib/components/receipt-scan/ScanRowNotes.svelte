<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import type { RowScanMeta } from '$lib/receipt-scan/rows';
	import { warningLabel, warningTone } from '$lib/receipt-scan/warning-labels';

	interface Props {
		scan: RowScanMeta | null | undefined;
	}

	let { scan }: Props = $props();
</script>

{#if scan && (scan.warnings.length > 0 || scan.summary || scan.transferCount > 1)}
	<div class="space-y-1.5" data-testid="scan-row-notes">
		{#if scan.warnings.length > 0}
			<div class="flex flex-wrap gap-1.5">
				{#each scan.warnings as warning, index (index)}
					<Badge variant={warningTone(warning) === 'danger' ? 'destructive' : 'warning'}>
						{warningLabel(warning)}
					</Badge>
				{/each}
			</div>
		{/if}
		{#if scan.summary || scan.transferCount > 1}
			<p class="text-xs text-muted-foreground">
				{#if scan.transferCount > 1}{scan.transferCount} transfers merged.{/if}
				{scan.summary ?? ''}
			</p>
		{/if}
	</div>
{/if}
