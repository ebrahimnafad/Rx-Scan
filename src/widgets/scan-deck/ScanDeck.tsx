// widgets/scan-deck/ScanDeck.tsx
// The scan deck: top card + depth stack illusion + swipe gestures + actions.
//
// Swipe gestures:
//   UP    → dispense
//   LEFT  → skip
//   DOWN  → due today
//   RIGHT → open schedule date picker
//
// Double-tap → open schedule date picker

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence, type AnimationDefinition } from 'motion/react';
import {
  ArrowUp, ArrowLeft, ArrowDown, ArrowRight, Calendar, SkipForward,
} from 'lucide-react';
import { NeumorphicCard } from '@/shared/ui/NeumorphicCard';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { Card } from '@/widgets/prescription-card';
import { UndoToastManager } from '@/shared/ui/UndoToast';
import { useSwipeGesture, type SwipeDirection } from '@/features/scan-gestures/lib/useSwipeGesture';
import { useScanDeckState } from './useScanDeckState';
import { tomorrowISO } from '@/shared/lib/excel-date';
import { ease } from '@/shared/config/motion-tokens';
import type { Settings } from '@/entities/prescription/model/types';

interface ScanDeckProps {
  settings?: Settings;
}

type CardFace = 'front' | 'back';

export function ScanDeck({ settings }: ScanDeckProps) {
  const [cardFace, setCardFace]         = useState<CardFace>('front');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(tomorrowISO());
  const [, setExitDir]                  = useState<SwipeDirection | null>(null);
  const [, setSwipingKey]              = useState<string | null>(null);
  const [dragDelta, setDragDelta]       = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [refuseDir, setRefuseDir]       = useState<SwipeDirection | null>(null);
  const lastTap                         = useRef(0);
  const tapTimeout                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitDirRef                      = useRef<SwipeDirection | null>(null);
  const swipingKeyRef                   = useRef<string | null>(null);

  const navigate = useNavigate();
  const { rx, nextRx, nextNextRx, pendingCount, skippedCount, filter, isPending, isSingleCard, dispense, skip, markDueToday, schedule, revealAllSkipped, updateInfo, notify, undoEntry, dismissUndo } =
    useScanDeckState();

  const currentKey = rx ? `${rx.id}-${rx.actioned_at || rx.updated_at || ''}` : 'empty';

  // Reset to front face whenever a new card arrives
  const prevKey = useRef(currentKey);
  useEffect(() => {
    if (currentKey !== prevKey.current) {
      prevKey.current = currentKey;
      setCardFace('front');
      setShowSchedule(false);
      setExitDir(null);
      setSwipingKey(null);
      exitDirRef.current = null;
      swipingKeyRef.current = null;
    }
  }, [currentKey]);

  // ── Actions with exit animation ─────────────────────────────────────────

  async function handleSwipe(dir: SwipeDirection) {
    if (!rx?.id) return;
    // All swipes require the card to be on the back face first (B1 fix)
    if (cardFace === 'front') {
      // Rational refusal: briefly nudge in the swipe direction then snap back
      setRefuseDir(dir);
      setTimeout(() => setRefuseDir(null), 500);
      return;
    }

    if (dir === 'right') {
      setShowSchedule(true);
      return;
    }

    setCardFace('front');
    exitDirRef.current = dir;
    swipingKeyRef.current = currentKey;
    setExitDir(dir);
    setSwipingKey(currentKey);
    setDragDelta({ x: 0, y: 0 });
    if (dir === 'up')   await dispense(rx.id);
    if (dir === 'left') await skip(rx.id);
    if (dir === 'down') await markDueToday(rx.id);

    if (isSingleCard) {
      navigate(filter ? `/?filter=${filter}` : '/');
    }
  }

  async function handleSchedule() {
    if (!rx?.id) return;
    setCardFace('front');
    exitDirRef.current = 'right';
    swipingKeyRef.current = currentKey;
    setExitDir('right');
    setSwipingKey(currentKey);
    setDragDelta({ x: 0, y: 0 });
    await schedule(rx.id, scheduleDate);

    if (isSingleCard) {
      navigate(filter ? `/?filter=${filter}` : '/');
    }
  }

  function handleNotify(via: 'whatsapp' | 'call') {
    if (!rx?.id) return;
    notify(rx.id, via);
  }

  // Single tap to flip, double-tap on back face to open schedule
  function handleTap() {
    const now = Date.now();
    const isDouble = now - lastTap.current < 300;
    lastTap.current = now;

    if (isDouble) {
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      setCardFace('back');
      setShowSchedule(true);
    } else {
      tapTimeout.current = setTimeout(() => {
        setCardFace(f => f === 'front' ? 'back' : 'front');
      }, 300);
    }
  }

  const swipeHandlers = useSwipeGesture({
    onSwipe: (dir: SwipeDirection) => {
      handleSwipe(dir);
    },
    onDragDelta: (dx, dy) => setDragDelta({ x: dx, y: dy }),
  });

  const exitVariant: AnimationDefinition | undefined =
    exitDirRef.current === 'up'    ? { y: -window.innerHeight, opacity: 0 } :
    exitDirRef.current === 'down'  ? { y: window.innerHeight, opacity: 0 } :
    exitDirRef.current === 'left'  ? { x: -window.innerWidth, opacity: 0 } :
    exitDirRef.current === 'right' ? { x: window.innerWidth, opacity: 0 } :
    undefined;

  // ── Loading state ──────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="space-y-4">
        <NeumorphicCard style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="flex justify-center mb-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-text-primary m-0 mb-2">Loading…</h2>
          <p className="text-sm text-text-muted m-0">Fetching next prescription.</p>
        </NeumorphicCard>
      </div>
    );
  }

  // ── Deck ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface shadow-neu-sm text-xs font-bold text-text-primary">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {pendingCount} in queue
        </span>
        {skippedCount > 0 && (
          <button
            onClick={revealAllSkipped}
            className="flex items-center gap-1 text-xs text-primary underline bg-transparent border-none cursor-pointer p-0"
          >
            <SkipForward size={12} />
            Reveal {skippedCount} skipped
          </button>
        )}
      </div>

      {/* Depth stack: 2 ghost cards behind */}
      <div className="relative" style={{ height: '49vh', minHeight: '340px' }}>
        {/* Ghost cards */}
        {[1, 2].map(i => {
          const ghostRx = i === 1 ? nextRx : nextNextRx;
          if (!ghostRx) return null;
          return (
            <motion.div
              key={ghostRx.id}
              initial={{ opacity: 0.85 - (i - 1) * 0.15, scale: 1 - i * 0.03 }}
              animate={{ opacity: 0.85 - (i - 1) * 0.15, scale: 1 - i * 0.03 }}
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translateY(${i * 6}px)`,
                zIndex: 10 - i,
              }}
            >
              <Card
                variant="front"
                rx={ghostRx}
                onInfoChange={() => {}}
                style={{ height: '100%', border: '6px solid rgba(255,255,255,0.5)' }}
              />
            </motion.div>
          );
        })}

        {/* Active card or Empty State */}
        <AnimatePresence>
          {!rx ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={ease.spring}
              className="absolute inset-0 z-20 flex flex-col justify-start pt-4"
            >
              <div className="space-y-4">
                <NeumorphicCard style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="text-xl font-bold text-text-primary m-0 mb-2">Queue Clear!</h2>
                  <p className="text-sm text-text-muted m-0">All prescriptions have been processed.</p>
                  {skippedCount > 0 && !filter && (
                    <NeumorphicButton onClick={revealAllSkipped} variant="ghost" className="mt-6 w-full justify-center">
                      <SkipForward size={15} /> Reveal {skippedCount} Skipped
                    </NeumorphicButton>
                  )}
                </NeumorphicCard>
                <NeumorphicButton
                  onClick={() => navigate(filter ? `/?filter=${filter}` : '/')}
                  variant="primary"
                  className="w-full justify-center"
                >
                  Return to Prescriptions
                </NeumorphicButton>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={currentKey}
              initial={false}
              animate={
                exitDirRef.current && swipingKeyRef.current === currentKey
                  ? (exitVariant as any)
                  : refuseDir
                    ? {
                        x: refuseDir === 'left' ? -28 : refuseDir === 'right' ? 28 : dragDelta.x,
                        y: refuseDir === 'up' ? -28 : refuseDir === 'down' ? 28 : dragDelta.y,
                        rotate: refuseDir === 'left' ? -3 : refuseDir === 'right' ? 3 : 0,
                      }
                    : { opacity: 1, scale: 1, x: dragDelta.x, y: dragDelta.y }
              }
              exit={exitVariant as any}
              transition={
                exitDirRef.current && swipingKeyRef.current === currentKey
                  ? { duration: 0.2 }
                  : refuseDir
                    ? { type: 'spring', stiffness: 600, damping: 20, mass: 0.6 }
                    : { duration: 0 }
              }
              className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing touch-none"
              {...swipeHandlers}
              onClick={handleTap}
            >
            <div style={{ perspective: '1200px', width: '100%', height: '100%' }}>
              <motion.div
                initial={false}
                animate={{ rotateY: cardFace === 'front' ? 0 : 180 }}
                transition={exitDirRef.current ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 25, mass: 1.2 }}
                style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
              >
                {/* Front Face */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    pointerEvents: cardFace === 'front' ? 'auto' : 'none',
                  }}
                >
                  <Card
                    variant="front"
                    rx={rx}
                    onInfoChange={updateInfo}
                    style={{ height: '100%', border: '6px solid rgba(255,255,255,0.5)' }}
                  />
                </div>

                {/* Back Face */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    pointerEvents: cardFace === 'back' ? 'auto' : 'none',
                  }}
                >
                  <Card
                    variant="back"
                    rx={rx}
                    settings={settings}
                    showSchedule={showSchedule}
                    scheduleDate={scheduleDate}
                    onScheduleDateChange={setScheduleDate}
                    onScheduleConfirm={handleSchedule}
                    onScheduleCancel={() => setShowSchedule(false)}
                    onNotify={handleNotify}
                    style={{ height: '100%', border: '6px solid rgba(255,255,255,0.5)' }}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Gesture hint bar */}
      <div className="flex items-center justify-between px-2 text-[11px]">
        <span className="flex items-center gap-1 text-danger"><ArrowLeft size={12} /> Skip</span>
        <span className="flex items-center gap-1 flex-col text-success">
          <ArrowUp size={12} />
          <span>Dispense</span>
        </span>
        <span className="flex items-center gap-1 text-warning"><ArrowDown size={12} /> Due Today</span>
        <span className="flex items-center gap-1 text-primary"><ArrowRight size={12} /> Schedule</span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-2">
        <NeumorphicButton
          onClick={() => handleSwipe('up')}
          disabled={cardFace === 'front'}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-2.5 gap-1"
        >
          <ArrowUp size={16} className="text-success" />
          <span className="text-[10px] text-success font-semibold">Dispense</span>
        </NeumorphicButton>
        <NeumorphicButton
          onClick={() => handleSwipe('left')}
          disabled={cardFace === 'front'}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-2.5 gap-1"
        >
          <ArrowLeft size={16} className="text-danger" />
          <span className="text-[10px] text-danger font-semibold">Skip</span>
        </NeumorphicButton>
        <NeumorphicButton
          onClick={() => handleSwipe('down')}
          disabled={cardFace === 'front'}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-2.5 gap-1"
        >
          <ArrowDown size={16} className="text-warning" />
          <span className="text-[10px] text-warning font-semibold">Due Today</span>
        </NeumorphicButton>
        <NeumorphicButton
          onClick={() => { if (cardFace !== 'front') setShowSchedule(v => !v); }}
          disabled={cardFace === 'front'}
          variant="ghost"
          size="sm"
          className="flex-col h-auto py-2.5 gap-1"
        >
          <Calendar size={16} className="text-primary" />
          <span className="text-[10px] text-primary font-semibold">Schedule</span>
        </NeumorphicButton>
      </div>

      {/* Undo toast */}
      <UndoToastManager action={undoEntry} onDismiss={dismissUndo} />
    </div>
  );
}
