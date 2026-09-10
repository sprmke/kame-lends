<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Eraser } from 'lucide-svelte';

	interface Props {
		onChange: (dataUrl: string | null) => void;
		onDrawingChange?: (isDrawing: boolean) => void;
		disabled?: boolean;
		class?: string;
	}

	let { onChange, onDrawingChange, disabled = false, class: className = '' }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let hasInk = $state(false);
	let isDrawing = false;
	let lastPoint: { x: number; y: number } | null = null;
	let activePointerId: number | null = null;

	function setupContext(ctx: CanvasRenderingContext2D, ratio: number) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(ratio, ratio);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 2;
		ctx.strokeStyle = '#0f172a';
	}

	function resizeCanvas() {
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const ratio = window.devicePixelRatio || 1;
		const previous = hasInk ? canvas.toDataURL('image/png') : null;
		canvas.width = Math.floor(rect.width * ratio);
		canvas.height = Math.floor(rect.height * ratio);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		setupContext(ctx, ratio);
		if (previous) {
			const image = new Image();
			image.onload = () => {
				const restoreCtx = canvas?.getContext('2d');
				if (!restoreCtx || !canvas) return;
				setupContext(restoreCtx, ratio);
				restoreCtx.drawImage(image, 0, 0, rect.width, rect.height);
			};
			image.src = previous;
		}
	}

	function getPoint(event: PointerEvent) {
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function emitChange() {
		onChange(canvas && hasInk ? canvas.toDataURL('image/png') : null);
	}

	function clear() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
		hasInk = false;
		onChange(null);
	}

	function drawLine(from: { x: number; y: number }, to: { x: number; y: number }) {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.stroke();
	}

	function onPointerDown(event: PointerEvent) {
		if (disabled || event.button !== 0 || activePointerId !== null) return;
		event.preventDefault();
		canvas?.setPointerCapture(event.pointerId);
		activePointerId = event.pointerId;
		isDrawing = true;
		onDrawingChange?.(true);
		lastPoint = getPoint(event);
	}

	function onPointerMove(event: PointerEvent) {
		if (disabled || !isDrawing || activePointerId !== event.pointerId) return;
		event.preventDefault();
		const point = getPoint(event);
		if (lastPoint) {
			drawLine(lastPoint, point);
			hasInk = true;
		}
		lastPoint = point;
	}

	function finishStroke(event: PointerEvent) {
		if (activePointerId !== event.pointerId) return;
		if (canvas?.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
		const hadInk = hasInk;
		isDrawing = false;
		activePointerId = null;
		lastPoint = null;
		onDrawingChange?.(false);
		if (hadInk) emitChange();
	}

	$effect(() => {
		if (!canvas) return;
		resizeCanvas();
		const observer = new ResizeObserver(() => resizeCanvas());
		observer.observe(canvas);
		return () => observer.disconnect();
	});
</script>

<div class="space-y-3 {className}">
	<div
		class="isolate touch-none overscroll-none rounded-xl border-2 border-dashed border-primary/50 bg-white shadow-sm contain-layout"
	>
		<canvas
			bind:this={canvas}
			class="block h-44 min-h-44 w-full cursor-crosshair touch-none select-none sm:h-52 sm:min-h-52"
			aria-label="Draw your signature here"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={finishStroke}
			onpointerleave={finishStroke}
			onpointercancel={finishStroke}
		></canvas>
	</div>
	<div class="flex flex-col gap-2.5">
		<p class="text-sm leading-relaxed text-muted-foreground">
			Draw your signature inside the box above using your mouse or finger.
		</p>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="w-full sm:w-auto sm:self-start"
			onclick={clear}
			disabled={disabled || !hasInk}
		>
			<Eraser class="mr-1.5 h-3.5 w-3.5" />
			Clear Signature
		</Button>
	</div>
</div>
