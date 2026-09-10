<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import ValidIdUpload from '$lib/components/common/ValidIdUpload.svelte';
	import ESignatureUpload from '$lib/components/common/ESignatureUpload.svelte';
	import { toast } from '$lib/toast';
	import { normalizeSignatureImageUrl, normalizeValidIdUrl } from '$lib/valid-id-document';
	import type { PartyIdentityDocuments } from '$lib/party-profile';

	interface Props {
		initialDocuments?: PartyIdentityDocuments;
	}

	let { initialDocuments = { validIdUrl: null, eSignatureUrl: null } }: Props = $props();

	let validIdUrl = $state<string | null>(initialDocuments.validIdUrl);
	let eSignatureUrl = $state<string | null>(initialDocuments.eSignatureUrl);
	let isSaving = $state(false);

	async function persist(next: PartyIdentityDocuments) {
		isSaving = true;
		try {
			const response = await fetch('/api/party-profile/me', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(next)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'Save failed');
			}

			const saved = (await response.json()) as PartyIdentityDocuments;
			validIdUrl = saved.validIdUrl;
			eSignatureUrl = saved.eSignatureUrl;
			toast.success('Saved');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Save failed');
			throw error;
		} finally {
			isSaving = false;
		}
	}

	async function handleValidIdChange(value: string | null) {
		const previous = validIdUrl;
		validIdUrl = value;
		try {
			await persist({
				validIdUrl: normalizeValidIdUrl(value),
				eSignatureUrl: normalizeSignatureImageUrl(eSignatureUrl)
			});
		} catch {
			validIdUrl = previous;
		}
	}

	async function handleSignatureChange(value: string | null) {
		const previous = eSignatureUrl;
		eSignatureUrl = value;
		try {
			await persist({
				validIdUrl: normalizeValidIdUrl(validIdUrl),
				eSignatureUrl: normalizeSignatureImageUrl(value)
			});
		} catch {
			eSignatureUrl = previous;
		}
	}
</script>

<Card.Root>
	<Card.Header class="pb-2">
		<Card.Title>Identity documents</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<ValidIdUpload
			value={validIdUrl}
			onChange={(value) => {
				void handleValidIdChange(value);
			}}
			disabled={isSaving}
			idPrefix="settings-valid-id"
		/>
		<ESignatureUpload
			value={eSignatureUrl}
			onChange={(value) => {
				void handleSignatureChange(value);
			}}
			disabled={isSaving}
			idPrefix="settings-signature"
		/>
	</Card.Content>
</Card.Root>
