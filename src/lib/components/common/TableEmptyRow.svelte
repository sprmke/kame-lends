<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { TABLE_EMPTY_CELL } from '$lib/table-styles';

	interface Props {
		colspan: number;
		message: string;
	}

	let { colspan, message }: Props = $props();
</script>

<Table.Row>
	<Table.Cell {colspan} class={TABLE_EMPTY_CELL}>{message}</Table.Cell>
</Table.Row>
