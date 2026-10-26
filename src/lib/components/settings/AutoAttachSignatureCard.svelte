<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { toast } from '$lib/toast';

	interface Props {
		initialEnabled: boolean;
		hasSavedSignature: boolean;
	}

	let { initialEnabled, hasSavedSignature }: Props = $props();

	// eslint-disable-next-line svelte/prefer-writable-derived -- synced from server load
	let enabled = $state(initialEnabled);
	$effect.pre(() => {
		enabled = initialEnabled;
	});

	let busy = $state(false);

	async function onToggle(checked: boolean) {
		if (!hasSavedSignature && checked) {
			toast.error('Upload a saved signature first.');
			return;
		}

		const previous = enabled;
		enabled = checked;
		busy = true;
		try {
			const res = await fetch('/api/signing/preferences', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ autoAttachSignature: checked })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				enabled = previous;
				toast.error((body as { error?: string }).error ?? 'Save failed');
				return;
			}
			toast.success('Saved');
		} catch {
			enabled = previous;
			toast.error('Save failed');
		} finally {
			busy = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Contract signing</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="flex items-start gap-3">
			<Checkbox
				id="auto-attach-signature"
				class="mt-0.5"
				checked={enabled}
				disabled={busy || (!hasSavedSignature && !enabled)}
				onCheckedChange={(checked) => {
					void onToggle(checked === true);
				}}
			/>
			<Label for="auto-attach-signature" class="cursor-pointer font-normal leading-snug">
				Auto attach my signature on loans
			</Label>
		</div>
	</Card.Content>
</Card.Root>
