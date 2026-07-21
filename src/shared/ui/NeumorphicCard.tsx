// shared/ui/NeumorphicCard.tsx
import type { ReactNode, CSSProperties, MouseEvent } from 'react';

interface NeumorphicCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

export function NeumorphicCard({ children, className = '', style, onClick }: NeumorphicCardProps) {
  return (
    <div
      className={`bg-surface rounded-neu-lg shadow-neu-card p-5 ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
