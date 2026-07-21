// widgets/prescription-list/FilterBar.tsx
// Icon pills with per-filter accent colors for the prescriptions list.

import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Layers, AlertTriangle, Clock, SkipForward, Star, Calendar, CheckCircle2,
} from 'lucide-react';
import type { FilterKey } from '@/entities/prescription/model/types';

interface FilterBarProps {
  active: FilterKey;
  onChange: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
}

const FILTERS: {
  key: FilterKey;
  label: string;
  icon: ComponentType<LucideProps>;
  color: string;       // text-* class for active icon/text
  bg: string;          // bg-* class for active pill
  badgeBg: string;     // bg-* class for count badge when active
  badgeText: string;   // text-* class for count badge when active
}[] = [
  { key: 'urgent',    label: 'Urgent',    icon: AlertTriangle,  color: 'text-danger',     bg: 'bg-danger',     badgeBg: 'bg-white/25',   badgeText: 'text-white'   },
  { key: 'scheduled', label: 'Scheduled', icon: Calendar,       color: 'text-primary',    bg: 'bg-primary',    badgeBg: 'bg-white/25',   badgeText: 'text-white'   },
  { key: 'pending',   label: 'Pending',   icon: Clock,          color: 'text-text-secondary', bg: 'bg-text-muted', badgeBg: 'bg-primary/15', badgeText: 'text-primary' },
  { key: 'skipped',   label: 'Skipped',   icon: SkipForward,    color: 'text-text-muted', bg: 'bg-text-muted', badgeBg: 'bg-white/20',   badgeText: 'text-white'   },
  { key: 'vip',       label: 'VIP',       icon: Star,           color: 'text-amber-600',  bg: 'bg-amber-500',  badgeBg: 'bg-white/25',   badgeText: 'text-white'   },
  { key: 'dispensed', label: 'Dispensed', icon: CheckCircle2,   color: 'text-success',    bg: 'bg-success',    badgeBg: 'bg-white/25',   badgeText: 'text-white'   },
  { key: 'all',       label: 'All',       icon: Layers,         color: 'text-primary',    bg: 'bg-primary',    badgeBg: 'bg-white/25',   badgeText: 'text-white'   },
];

export function FilterBar({ active, onChange, counts }: FilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
      {FILTERS.map(({ key, label, icon: Icon, color, bg, badgeBg, badgeText }) => {
        const count = counts[key];
        const isActive = key === active;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={[
              'flex-shrink-0 flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-full text-xs font-semibold',
              'border-2 cursor-pointer transition-all duration-150 whitespace-nowrap',
              isActive
                ? `${bg} text-white border-${bg.replace('bg-', '')} shadow-neu-btn`
                : 'bg-surface border-black/[0.06] text-text-secondary hover:text-text-primary hover:border-black/10 shadow-neu-sm',
            ].join(' ')}
          >
            <Icon
              size={13}
              className={isActive ? 'text-white' : `${color} opacity-60`}
            />
            {label}
            {count > 0 && (
              <span
                className={[
                  'min-w-[18px] h-4.5 px-1 rounded-full text-[9px] font-bold',
                  'flex items-center justify-center',
                  isActive ? `${badgeBg} ${badgeText}` : 'bg-primary/15 text-primary',
                ].join(' ')}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
