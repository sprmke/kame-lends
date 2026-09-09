<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { backupFilename } from '$lib/brand';
	import { toast } from '$lib/toast';
	import { CheckCircle2, Download, Loader2 } from 'lucide-svelte';

	interface Props {
		variant?: 'default' | 'outline' | 'ghost';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
		showLabel?: boolean;
	}

	let {
		variant = 'outline',
		size = 'default',
		class: className,
		showLabel = true
	}: Props = $props();

	let isDownloading = $state(false);
	let justDownloaded = $state(false);

	async function handleDownload() {
		isDownloading = true;
		justDownloaded = false;

		try {
			const response = await fetch('/api/backup?download=true');
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to create backup');
			}

			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = backupFilename(new Date());
			if (contentDisposition) {
				const match = contentDisposition.match(/filename="(.+)"/);
				if (match) filename = match[1];
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			justDownloaded = true;
			toast.success('Backup downloaded', `Saved as ${filename}`);
			setTimeout(() => {
				justDownloaded = false;
			}, 3000);
		} catch (error) {
			console.error('Error downloading backup:', error);
			toast.error(
				'Failed to download backup',
				error instanceof Error ? error.message : 'Unknown error'
			);
		} finally {
			isDownloading = false;
		}
	}
</script>

<Button {variant} {size} class={className} disabled={isDownloading} onclick={handleDownload}>
	{#if isDownloading}
		<Loader2 class="h-4 w-4 animate-spin" />
	{:else if justDownloaded}
		<CheckCircle2 class="h-4 w-4 text-green-500" />
	{:else}
		<Download class="h-4 w-4" />
	{/if}
	{#if showLabel}
		<span class="ml-2">
			{isDownloading ? 'Downloading...' : justDownloaded ? 'Downloaded!' : 'Download Backup'}
		</span>
	{/if}
</Button>
