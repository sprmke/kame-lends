'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  onDrawingChange?: (isDrawing: boolean) => void;
  disabled?: boolean;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

interface LockedScroll {
  x: number;
  y: number;
}

function setupCanvasContext(ctx: CanvasRenderingContext2D, ratio: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f172a';
}

function lockPageScroll(): LockedScroll {
  const locked = { x: window.scrollX, y: window.scrollY };
  document.body.style.position = 'fixed';
  document.body.style.top = `-${locked.y}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
  return locked;
}

function unlockPageScroll(locked: LockedScroll | null) {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  document.documentElement.style.overflow = '';
  document.documentElement.style.overscrollBehavior = '';
  if (locked) {
    window.scrollTo(locked.x, locked.y);
  }
}

export function SignaturePad({
  onChange,
  onDrawingChange,
  disabled = false,
  className = '',
}: SignaturePadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const hasInkRef = useRef(false);
  const lockedScrollRef = useRef<LockedScroll | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const pendingResizeRef = useRef(false);
  const resizeRafRef = useRef<number | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const getPoint = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [],
  );

  const emitChange = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL('image/png'));
  }, [onChange]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ratio = window.devicePixelRatio || 1;
    const newWidth = Math.floor(rect.width * ratio);
    const newHeight = Math.floor(rect.height * ratio);

    if (canvas.width === newWidth && canvas.height === newHeight) return;

    if (isDrawingRef.current) {
      pendingResizeRef.current = true;
      return;
    }

    const previousDataUrl =
      hasInkRef.current && canvas.width > 0 && canvas.height > 0
        ? canvas.toDataURL('image/png')
        : null;

    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setupCanvasContext(ctx, ratio);

    if (previousDataUrl) {
      const image = new Image();
      image.onload = () => {
        const restoreCtx = canvas.getContext('2d');
        if (!restoreCtx) return;
        setupCanvasContext(restoreCtx, ratio);
        restoreCtx.drawImage(image, 0, 0, rect.width, rect.height);
      };
      image.src = previousDataUrl;
    }
  }, []);

  const processPendingResize = useCallback(() => {
    if (!pendingResizeRef.current) return;
    pendingResizeRef.current = false;
    resizeCanvas();
    if (hasInkRef.current) {
      emitChange();
    }
  }, [resizeCanvas, emitChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas();

    const observer = new ResizeObserver(() => {
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        resizeCanvas();
      });
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      if (resizeRafRef.current !== null) {
        cancelAnimationFrame(resizeRafRef.current);
      }
    };
  }, [resizeCanvas]);

  const preventDocumentTouch = useCallback((event: TouchEvent) => {
    if (!isDrawingRef.current) return;
    event.preventDefault();
  }, []);

  const releaseDrawingLock = useCallback(() => {
    document.removeEventListener('touchstart', preventDocumentTouch);
    document.removeEventListener('touchmove', preventDocumentTouch);
    document.removeEventListener('touchend', preventDocumentTouch);
    document.removeEventListener('touchcancel', preventDocumentTouch);

    if (lockedScrollRef.current) {
      unlockPageScroll(lockedScrollRef.current);
      lockedScrollRef.current = null;
    }

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      onDrawingChange?.(false);
    }

    activePointerIdRef.current = null;
    lastPointRef.current = null;
  }, [onDrawingChange, preventDocumentTouch]);

  useEffect(() => {
    return () => {
      releaseDrawingLock();
    };
  }, [releaseDrawingLock]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    hasInkRef.current = false;
    setHasInk(false);
    onChange(null);
  }, [onChange]);

  const drawLine = (from: Point, to: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || event.button !== 0) return;
    if (activePointerIdRef.current !== null) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    activePointerIdRef.current = event.pointerId;
    lockedScrollRef.current = lockPageScroll();
    isDrawingRef.current = true;
    onDrawingChange?.(true);
    lastPointRef.current = getPoint(event);

    document.addEventListener('touchstart', preventDocumentTouch, {
      passive: false,
    });
    document.addEventListener('touchmove', preventDocumentTouch, {
      passive: false,
    });
    document.addEventListener('touchend', preventDocumentTouch, {
      passive: false,
    });
    document.addEventListener('touchcancel', preventDocumentTouch, {
      passive: false,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (
      disabled ||
      !isDrawingRef.current ||
      activePointerIdRef.current !== event.pointerId
    ) {
      return;
    }
    event.preventDefault();
    const point = getPoint(event);
    const lastPoint = lastPointRef.current;
    if (lastPoint) {
      drawLine(lastPoint, point);
      hasInkRef.current = true;
      setHasInk(true);
    }
    lastPointRef.current = point;
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const hadInk = hasInkRef.current;
    releaseDrawingLock();
    processPendingResize();
    if (hadInk) {
      emitChange();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        ref={containerRef}
        className="isolate touch-none overscroll-none contain-layout rounded-xl border-2 border-dashed border-primary/50 bg-white shadow-sm"
      >
        <canvas
          ref={canvasRef}
          className="block h-44 w-full min-h-44 touch-none cursor-crosshair select-none sm:h-52 sm:min-h-52"
          aria-label="Draw your signature here"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Draw your signature inside the box above using your mouse or finger.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={disabled || !hasInk}
        >
          <Eraser className="mr-1.5 h-3.5 w-3.5" />
          Clear Signature
        </Button>
      </div>
    </div>
  );
}
