<script lang="ts">
	import {
		ArrowDownToLine,
		ArrowUpFromLine,
		CheckCircle,
		Copy,
		Edit,
		ExternalLink,
		Eye,
		FileText,
		Trash2,
		Wallet
	} from 'lucide-svelte';
	import type { LoanActionIcon } from './action-buttons';

	interface Props {
		icon: LoanActionIcon;
		class?: string;
	}

	let { icon, class: className = 'h-4 w-4' }: Props = $props();
</script>

{#if icon === 'fund'}
	<ArrowUpFromLine class={className} />
{:else if icon === 'received'}
	<ArrowDownToLine class={className} />
{:else if icon === 'pay'}
	<Wallet class={className} />
{:else if icon === 'edit'}
	<Edit class={className} />
{:else if icon === 'duplicate'}
	<Copy class={className} />
{:else if icon === 'contract'}
	<FileText class={className} />
{:else if icon === 'complete'}
	<CheckCircle class={className} />
{:else if icon === 'view'}
	<ExternalLink class={className} />
{:else if icon === 'delete'}
	<Trash2 class={className} />
{/if}
