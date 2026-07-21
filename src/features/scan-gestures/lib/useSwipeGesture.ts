// features/scan-gestures/lib/useSwipeGesture.ts
// Touch + pointer swipe detection for the scan deck.
// Fires onSwipe('up'|'down'|'left'|'right') when threshold is exceeded.

import { useRef, useCallback } from 'react';

export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

interface SwipeOptions {
  threshold?: number;   // px before a swipe is confirmed, default 60
  onSwipe: (dir: SwipeDirection) => void;
  onDragDelta?: (dx: number, dy: number) => void;
}

interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp:   (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
}

export function useSwipeGesture({ threshold = 60, onSwipe, onDragDelta }: SwipeOptions): SwipeHandlers {
  const start    = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const wasSwiped = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    dragging.current = true;
    wasSwiped.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    onDragDelta?.(dx, dy);
  }, [onDragDelta]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !start.current) return;
    dragging.current = false;
    onDragDelta?.(0, 0);

    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < threshold) return; // not a swipe

    wasSwiped.current = true;
    if (absDy > absDx) {
      onSwipe(dy < 0 ? 'up' : 'down');
    } else {
      onSwipe(dx < 0 ? 'left' : 'right');
    }
  }, [threshold, onSwipe]);

  const onPointerCancel = useCallback(() => {
    dragging.current = false;
    start.current = null;
    onDragDelta?.(0, 0);
  }, [onDragDelta]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (wasSwiped.current) {
      e.stopPropagation();
      e.preventDefault();
      wasSwiped.current = false;
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture };
}
