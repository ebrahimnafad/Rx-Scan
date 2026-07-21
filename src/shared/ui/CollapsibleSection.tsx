// shared/ui/CollapsibleSection.tsx
import { useState } from 'react';
import type { ReactNode, ComponentType } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideProps } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { NeumorphicCard } from './NeumorphicCard';
import { duration, ease } from '@/shared/config/motion-tokens';

interface CollapsibleSectionProps {
  icon: ComponentType<LucideProps>;
  title: string;
  color?: string;
  badge?: ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  icon: Icon,
  title,
  color = 'text-primary',
  badge,
  summary,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <NeumorphicCard style={{ padding: 0 }}>
      {/* ── Header (always visible) ──────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 pt-5 pb-0 bg-transparent border-none cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon size={16} className={`${color} shrink-0`} />
          <span className="text-base font-semibold text-text-primary truncate">
            {title}
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: duration.fast / 1000, ease: ease.standard }}
          className="shrink-0"
        >
          <ChevronDown size={16} className="text-text-muted" />
        </motion.span>
      </button>

      {/* ── Collapsed summary ────────────────────────────── */}
      {!open && summary && (
        <p className="px-5 pb-4 pt-1 m-0 text-[11px] text-text-muted leading-snug truncate">
          {summary}
        </p>
      )}

      {/* ── Expandable content ───────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.normal / 1000, ease: ease.standard }}
            className="overflow-hidden"
          >
            <div className="px-5 pt-3 pb-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NeumorphicCard>
  );
}
