// shared/ui/UndoToast.tsx
// 6-second countdown toast shown after every scan action.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';

interface UndoToastProps {
  message: string;
  duration?: number; // ms, default 6000
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ message, duration = 6000, onUndo, onDismiss }: UndoToastProps) {
  const [remaining, setRemaining] = useState(duration / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(r => r - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (remaining <= 0) onDismiss();
  }, [remaining, onDismiss]);

  const progress = (remaining / (duration / 1000)) * 100;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-neu-floating"
      style={{
        background: 'linear-gradient(135deg, #4A5568, #2D3748)',
        minWidth: '280px',
        maxWidth: '360px',
      }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-white/60 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <p className="text-sm text-white font-medium flex-1 m-0">{message}</p>
        <button
          onClick={onUndo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15
                     text-white text-xs font-semibold cursor-pointer border-none hover:bg-white/25
                     transition-colors"
        >
          <RotateCcw size={12} />
          Undo ({remaining}s)
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-full bg-white/10 text-white/60 cursor-pointer
                     border-none hover:bg-white/20 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

interface UndoToastManagerProps {
  action: { id: string; message: string; onUndo: () => void } | null;
  onDismiss: () => void;
}

export function UndoToastManager({ action, onDismiss }: UndoToastManagerProps) {
  return (
    <div className="fixed bottom-28 left-0 right-0 flex justify-center z-50 px-4 pointer-events-none">
      <AnimatePresence mode="wait">
        {action && (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto"
          >
            <UndoToast
              message={action.message}
              onUndo={() => { action.onUndo(); onDismiss(); }}
              onDismiss={onDismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
