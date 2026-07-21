// shared/ui/VipBadge.tsx
export function VipBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-bold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
      ].join(' ')}
      style={{ background: 'var(--color-vip-bg)', color: 'var(--color-vip)' }}
    >
      ⭐ VIP
    </span>
  );
}
