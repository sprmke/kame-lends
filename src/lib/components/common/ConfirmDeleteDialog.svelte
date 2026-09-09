<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description: string;
		onConfirm: () => Promise<void> | void;
	}

	let { open, onOpenChange, title, description, onConfirm }: Props = $props();

	let isDeleting = $state(false);

	async function handleConfirm() {
		isDeleting = true;
		try {
			await onConfirm();
			onOpenChange(false);
		} catch {
			// Caller surfaces the error; keep dialog open for retry.
		} finally {
			isDeleting = false;
		}
	}
</script>

<AlertDialog.Root
	{open}
	onOpenChange={(next) => {
		if (!isDeleting) onOpenChange(next);
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				disabled={isDeleting}
				onclick={(event) => {
					event.preventDefault();
					handleConfirm();
				}}
			>
				{isDeleting ? 'Deleting...' : 'Delete'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
