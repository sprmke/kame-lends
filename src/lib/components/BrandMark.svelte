<script lang="ts">
	import {
		BRAND_FRONT_FLIPPER_PATH,
		BRAND_HEAD,
		BRAND_MARK_VIEWBOX,
		BRAND_MIRROR_TRANSFORM,
		BRAND_REAR_FLIPPER_PATH,
		BRAND_SHELL_PATH,
		BRAND_TAIL_PATH,
		brandScutes,
		type BrandMarkDetail
	} from '$lib/brand-mark';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		/** `compact` (default) keeps the shell pattern legible at icon sizes. */
		detail?: BrandMarkDetail;
	}

	let { class: className, detail = 'compact' }: Props = $props();

	const uid = $props.id();
	const scutes = $derived(brandScutes(detail));
</script>

<svg
	viewBox={BRAND_MARK_VIEWBOX}
	fill="currentColor"
	xmlns="http://www.w3.org/2000/svg"
	class={cn('shrink-0', className)}
	aria-hidden="true"
>
	<defs>
		<mask id="{uid}-limbs" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
			<rect width="100" height="100" fill="#fff" />
			<path d={BRAND_SHELL_PATH} fill="#000" stroke="#000" stroke-width={scutes.limbGap} />
		</mask>
		<mask id="{uid}-shell" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
			<rect width="100" height="100" fill="#fff" />
			<g
				fill="none"
				stroke="#000"
				stroke-width={scutes.seam}
				stroke-linejoin="round"
				stroke-linecap="round"
			>
				<polygon points={scutes.hexPoints} />
				<path d={scutes.seamsPath} />
			</g>
		</mask>
	</defs>
	<g mask="url(#{uid}-limbs)">
		<ellipse cx={BRAND_HEAD.cx} cy={BRAND_HEAD.cy} rx={BRAND_HEAD.rx} ry={BRAND_HEAD.ry} />
		<path d={BRAND_FRONT_FLIPPER_PATH} />
		<path d={BRAND_FRONT_FLIPPER_PATH} transform={BRAND_MIRROR_TRANSFORM} />
		<path d={BRAND_REAR_FLIPPER_PATH} />
		<path d={BRAND_REAR_FLIPPER_PATH} transform={BRAND_MIRROR_TRANSFORM} />
		<path d={BRAND_TAIL_PATH} />
	</g>
	<path d={BRAND_SHELL_PATH} mask="url(#{uid}-shell)" />
</svg>
