<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import ResponsiveModal from '$lib/components/common/ResponsiveModal.svelte';
	import { toast } from '$lib/toast';
	import { groupSettingsActionClass } from '$lib/groups/group-settings-actions';
	import type { DefaultWitnessProfile } from '$lib/groups/default-witnesses';

	interface Props {
		groupId: number;
	}

	let { groupId }: Props = $props();

	type DirectoryWitness = {
		id: number;
		name: string;
		email: string | null;
		address: string | null;
		validIdUrl: string | null;
		eSignatureUrl: string | null;
	};

	let selected = $state<DefaultWitnessProfile[]>([]);
	let directory = $state<DirectoryWitness[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let pickerOpen = $state(false);
	let query = $state('');

	const selectedIds = $derived(new Set(selected.map((row) => row.id)));
	const available = $derived(
		directory.filter((row) => {
			if (selectedIds.has(row.id)) return false;
			const needle = query.trim().toLowerCase();
			if (!needle) return true;
			return (
				row.name.toLowerCase().includes(needle) ||
				(row.email ?? '').toLowerCase().includes(needle)
			);
		})
	);

	onMount(() => {
		void loadSelected();
	});

	async function loadSelected() {
		loading = true;
		try {
			const response = await fetch(`/api/groups/${groupId}/default-witnesses`);
			if (!response.ok) return;
			const body = (await response.json()) as { witnesses?: DefaultWitnessProfile[] };
			selected = body.witnesses ?? [];
		} finally {
			loading = false;
		}
	}

	async function save(next: DefaultWitnessProfile[]) {
		const previous = selected;
		selected = next;
		busy = true;
		try {
			const response = await fetch(`/api/groups/${groupId}/default-witnesses`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					witnesses: next.map((row) => ({
						witnessId: row.id,
						autoSign: row.autoSign
					}))
				})
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				selected = previous;
				toast.error(body?.error ?? 'Could not save witnesses');
				return;
			}
			const body = (await response.json()) as { witnesses?: DefaultWitnessProfile[] };
			selected = body.witnesses ?? next;
		} catch {
			selected = previous;
			toast.error('Could not save witnesses');
		} finally {
			busy = false;
		}
	}

	async function openPicker() {
		if (selected.length >= 2) {
			toast.error('A contract holds two witnesses.');
			return;
		}
		pickerOpen = true;
		query = '';
		if (directory.length > 0) return;
		const response = await fetch('/api/witnesses?simple=true');
		if (!response.ok) return;
		directory = (await response.json()) as DirectoryWitness[];
	}

	function addWitness(row: DirectoryWitness) {
		if (selected.length >= 2) {
			toast.error('A contract holds two witnesses.');
			return;
		}
		pickerOpen = false;
		void save([
			...selected,
			{
				id: row.id,
				name: row.name,
				email: row.email,
				address: row.address,
				validIdUrl: row.validIdUrl,
				eSignatureUrl: row.eSignatureUrl,
				autoSign: false
			}
		]);
	}

	function setAutoSign(id: number, autoSign: boolean) {
		void save(selected.map((row) => (row.id === id ? { ...row, autoSign } : row)));
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-base">Default witnesses</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		{#if loading}
			<p class="text-sm text-muted-foreground">Loading…</p>
		{:else if selected.length > 0}
			<ul class="divide-y divide-border/60 rounded-lg border border-border/60">
				{#each selected as row (row.id)}
					<li class="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="min-w-0 space-y-1">
							<p class="truncate text-sm font-medium">{row.name}</p>
							{#if !row.eSignatureUrl?.trim()}
								<Badge variant="secondary">No signature</Badge>
							{/if}
						</div>
						<div class="flex flex-wrap items-center gap-3">
							<Label class="flex min-h-11 items-center gap-2 text-sm font-normal">
								<Checkbox
									checked={row.autoSign}
									disabled={busy}
									onCheckedChange={(checked) => setAutoSign(row.id, Boolean(checked))}
								/>
								Auto-sign
							</Label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="min-h-11 text-destructive"
								disabled={busy}
								onclick={() => save(selected.filter((item) => item.id !== row.id))}
							>
								Remove
							</Button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		<Button
			type="button"
			variant="outline"
			class={groupSettingsActionClass}
			disabled={busy || loading}
			onclick={() => void openPicker()}
		>
			Add witness
		</Button>
	</Card.Content>
</Card.Root>

<ResponsiveModal open={pickerOpen} onOpenChange={(open) => (pickerOpen = open)} title="Witnesses">
	<div class="space-y-3">
		<Input
			value={query}
			placeholder="Name or email"
			aria-label="Search witnesses"
			oninput={(event) => (query = event.currentTarget.value)}
		/>
		{#if available.length === 0}
			<p class="py-6 text-center text-sm text-muted-foreground">No witnesses</p>
		{:else}
			<ul class="space-y-1">
				{#each available as row (row.id)}
					<li>
						<button
							type="button"
							class="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-muted"
							onclick={() => addWitness(row)}
						>
							<span class="truncate">{row.name}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</ResponsiveModal>
