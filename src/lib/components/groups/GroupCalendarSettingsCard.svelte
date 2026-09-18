<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import SyncCalendarButton from '$lib/components/common/SyncCalendarButton.svelte';
	import { toast } from '$lib/toast';
	import { Calendar } from 'lucide-svelte';
	import {
		groupSettingsActionClass,
		groupSettingsActionsLayoutClass
	} from '$lib/groups/group-settings-actions';

	interface Props {
		groupId: number;
		status?: string | null;
		googleCalendarId?: string | null;
		lastError?: string | null;
		subscribeUrl?: string | null;
		onSynced?: () => void | Promise<void>;
	}

	let {
		groupId,
		status = null,
		googleCalendarId = null,
		lastError = null,
		subscribeUrl = null,
		onSynced
	}: Props = $props();

	let creating = $state(false);

	const hasCalendar = $derived(Boolean(googleCalendarId));
	const statusLabel = $derived.by(() => {
		if (!status && !googleCalendarId) return 'Not created';
		if (status === 'active') return 'Active';
		if (status === 'provisioning') return 'Setting up';
		if (status === 'error') return 'Needs attention';
		return status ?? 'Not created';
	});

	const syncEndpoint = $derived(`/api/groups/${groupId}/calendar/sync`);

	async function createCalendar() {
		creating = true;
		try {
			const res = await fetch(`/api/groups/${groupId}/sync`, { method: 'POST' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error((body as { error?: string }).error ?? 'Could not create calendar');
			}
			toast.success('Calendar creating');
			await onSynced?.();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Create failed');
		} finally {
			creating = false;
		}
	}

	function copySubscribe() {
		const url =
			subscribeUrl ??
			(googleCalendarId
				? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(googleCalendarId)}`
				: null);
		if (!url) {
			toast.error('No calendar link yet');
			return;
		}
		void import('$lib/pwa/share').then(({ shareOrCopy }) =>
			shareOrCopy({ title: 'Calendar subscribe link', url }).then((result) => {
				if (result === 'shared') toast.success('Link shared');
				else if (result === 'copied') toast.success('Subscribe link copied');
				else toast.error('Could not share link');
			})
		);
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-row items-center gap-2">
		<Calendar class="size-4 text-muted-foreground" aria-hidden="true" />
		<Card.Title class="text-base">Google Calendar</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<p class="text-sm">
			Status: <span class="font-medium">{statusLabel}</span>
		</p>
		{#if lastError && status === 'error'}
			<p class="text-sm text-destructive">{lastError}</p>
		{/if}
		<p class="text-sm text-muted-foreground">
			One calendar for this group. Shared read-only with members who have an email.
		</p>
		<div class={groupSettingsActionsLayoutClass}>
			{#if !hasCalendar}
				<Button
					type="button"
					variant="default"
					class={groupSettingsActionClass}
					disabled={creating}
					onclick={() => void createCalendar()}
				>
					{creating ? 'Creating…' : 'Create calendar'}
				</Button>
			{:else}
				<SyncCalendarButton
					variant="outline"
					label="Sync events"
					triggerClass={groupSettingsActionClass}
					{syncEndpoint}
					cleanupEndpoint={null}
					showClear={true}
				/>
				{#if subscribeUrl || googleCalendarId}
					<Button
						type="button"
						variant="outline"
						class={groupSettingsActionClass}
						onclick={copySubscribe}
					>
						Copy subscribe link
					</Button>
				{/if}
			{/if}
		</div>
	</Card.Content>
</Card.Root>
