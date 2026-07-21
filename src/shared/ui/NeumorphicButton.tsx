// shared/ui/NeumorphicButton.tsx
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { duration, ease } from '@/shared/config/motion-tokens';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface NeumorphicButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-primary text-white shadow-neu-btn',
  secondary: 'bg-secondary text-white shadow-neu-btn',
  success:   'bg-success text-white shadow-neu-btn',
  danger:    'bg-danger text-white shadow-neu-btn',
  ghost:     'bg-transparent text-text-primary shadow-neu',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
};

export function NeumorphicButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
}: NeumorphicButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: duration.fast / 1000, ease: ease.standard }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide',
        'cursor-pointer border-none transition-opacity',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {children}
    </motion.button>
  );
}
