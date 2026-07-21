// app/layout/RootLayout.tsx
import { useOutlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { PageShell } from '@/shared/ui/PageShell';
import { BottomNav } from '@/widgets/bottom-nav/BottomNav';
import { BranchBadge } from '@/widgets/branch-badge/BranchBadge';
import { transition } from '@/shared/config/motion-tokens';
import { useOverdueScheduler } from '@/app/hooks/useOverdueScheduler';

export default function RootLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  useOverdueScheduler(); // runs globally, once per session

  return (
    <PageShell>
      <div className="flex justify-between items-center mb-4">
        <BranchBadge />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition.page}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </PageShell>
  );
}
