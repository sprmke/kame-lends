<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import type { IconComponent } from '$lib/types/icon';
	interface Props {
		label: string;
		icon?: IconComponent;
		minValue: string;
		maxValue: string;
		onMinChange: (value: string) => void;
		onMaxChange: (value: string) => void;
		minPlaceholder?: string;
		maxPlaceholder?: string;
		type?: 'number' | 'text';
	}

	let {
		label,
		icon: Icon,
		minValue,
		maxValue,
		onMinChange,
		onMaxChange,
		minPlaceholder = 'Min',
		maxPlaceholder = 'Max',
		type = 'number'
	}: Props = $props();
</script>

<div class="space-y-2">
	<label class="flex items-center gap-1 text-xs font-semibold">
		{#if Icon}
			<Icon class="h-3.5 w-3.5" />
		{/if}
		{label}
	</label>
	<div class="flex items-center gap-2">
		<Input
			{type}
			placeholder={minPlaceholder}
			value={minValue}
			oninput={(e) => onMinChange(e.currentTarget.value)}
			class="text-sm"
		/>
		<span class="text-muted-foreground">-</span>
		<Input
			{type}
			placeholder={maxPlaceholder}
			value={maxValue}
			oninput={(e) => onMaxChange(e.currentTarget.value)}
			class="text-sm"
		/>
	</div>
</div>
