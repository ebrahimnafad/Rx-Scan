// shared/ui/PageShell.tsx
import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
}

/**
 * Mobile-first page wrapper that replaces the repeated inline style block
 * (minHeight: 100vh, background, padding, paddingBottom: 100px) from every screen.
 */
export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-surface text-text-primary font-sans px-6 pt-6 pb-28 rounded-[28px] overflow-hidden">
      {children}
    </div>
  );
}
