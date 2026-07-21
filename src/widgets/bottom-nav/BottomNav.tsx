// widgets/bottom-nav/BottomNav.tsx — RxScan 3-tab nav
import { NavLink } from 'react-router';
import { ClipboardList, ScanLine, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { duration, ease } from '@/shared/config/motion-tokens';
import { useBadgeCounts } from '@/app/hooks/useBadgeCounts';

const tabs = [
  { to: '/settings', icon: Settings,      label: 'Settings'      },
  { to: '/scan',     icon: ScanLine,      label: 'Scan'          },
  { to: '/',         icon: ClipboardList, label: 'Prescriptions' },
] as const;

export function BottomNav() {
  const { overdueCount, pendingCount } = useBadgeCounts();

  return (
    <div className="fixed bottom-6 left-6 right-6 z-50">
      <div
        className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-primary border-4 border-white/25 relative overflow-visible"
        style={{ boxShadow: '0 12px 32px rgba(24,98,245,0.35), 0 4px 8px rgba(24,98,245,0.2)' }}
      >
        {tabs.map(({ to, icon: Icon, label }) => {
          const badge    = to === '/' ? overdueCount : to === '/scan' ? pendingCount : 0;
          const isUrgent = to === '/';
          return (
            <NavLink key={to} to={to} end={to === '/'} className="flex-1 relative">
              {({ isActive }) => (
                <>
                  {/* Gliding light source (blue, matching primary palette) */}
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-active-bg"
                      className="absolute z-0 overflow-hidden rounded-2xl pointer-events-none"
                      style={{ inset: '-4px' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    >
                      {/* White Light Source Top Line */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-white rounded-b-md shadow-[0_0_14px_4px_rgba(255,255,255,0.6)]" />
                      
                      {/* Downward Conical Beam */}
                      <div 
                        className="absolute top-1 left-1/2 -translate-x-1/2 w-24 h-14 blur-[2px]"
                        style={{
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)',
                          clipPath: 'polygon(29% 0%, 71% 0%, 100% 100%, 0% 100%)'
                        }}
                      />
                    </motion.div>
                  )}

                  {/* Tab Content */}
                  <motion.div
                    animate={{ scale: isActive ? 1 : 0.95 }}
                    transition={{ duration: duration.normal / 1000, ease: ease.standard }}
                    className="relative flex flex-col items-center justify-center gap-1 px-6 py-2.5 rounded-xl border-none cursor-pointer outline-none z-10"
                  >
                    {/* Icon + badge */}
                    <div className="relative">
                      <Icon
                        size={22}
                        color={isActive ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        style={{
                          filter: isActive ? 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' : 'none',
                          transition: `all ${duration.normal}ms`,
                          position: 'relative',
                          zIndex: 2,
                        }}
                      />
                      {badge > 0 && (
                        <span
                          className={`absolute -top-2 -right-3 rounded-full
                                     text-white font-bold flex items-center justify-center
                                     shadow-[0_2px_6px_rgba(0,0,0,0.25)]
                                     ${isUrgent
                                       ? 'min-w-[18px] h-[18px] px-1 text-[9px] bg-danger z-30'
                                       : 'min-w-[16px] h-4 px-1 text-[8px] bg-text-secondary opacity-90 z-30'
                                     }`}
                        >
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>

                    <span
                      className="text-[9px] tracking-wide leading-none"
                      style={{
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                        transition: `all ${duration.normal}ms`,
                      }}
                    >
                      {label}
                    </span>
                  </motion.div>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
