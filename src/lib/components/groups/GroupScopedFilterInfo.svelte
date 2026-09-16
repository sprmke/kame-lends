<script lang="ts">
	import { formatCount, formatText } from '$lib/format';

	interface Props {
		count: number;
		scopeNoun: string;
		groupName: string;
		groupId: number;
	}

	let { count, scopeNoun, groupName, groupId }: Props = $props();
</script>

<p class="text-sm text-muted-foreground">
	Showing your {formatCount(count)}
	{scopeNoun} in
	<span class="font-medium text-foreground">{formatText(groupName)}</span>
	<a
		href="/groups/{groupId}?tab=loans"
		data-sveltekit-preload-data="tap"
		class="ml-2 text-primary hover:underline"
	>
		All group loans
	</a>
</p>
