<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { PAYMENT_NOTES_MAX_LENGTH } from '$lib/payment-notes';

	interface Props {
		id: string;
		value?: string | null;
		disabled?: boolean;
		onChange: (value: string) => void;
	}

	let { id, value = '', disabled = false, onChange }: Props = $props();
</script>

<div class="space-y-2">
	<Label for={id}>Notes</Label>
	<Textarea
		{id}
		rows={3}
		maxlength={PAYMENT_NOTES_MAX_LENGTH}
		value={value ?? ''}
		placeholder="Optional"
		{disabled}
		oninput={(event) => onChange((event.currentTarget as HTMLTextAreaElement).value)}
	/>
</div>
