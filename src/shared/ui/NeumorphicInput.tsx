// shared/ui/NeumorphicInput.tsx
import type { ChangeEvent, ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

export interface NeumorphicInputProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: ComponentType<LucideProps>;
  error?: string;
  disabled?: boolean;
  type?: string;
}

export function NeumorphicInput({
  value, onChange, placeholder, icon: Icon, error, disabled, type = 'text',
}: NeumorphicInputProps) {
  return (
    <div>
      <div
        className="flex items-center gap-3 bg-surface rounded-neu-md shadow-neu-inset px-4 py-3"
        style={error ? { boxShadow: '0 0 0 1.5px var(--color-danger)' } : undefined}
      >
        {Icon && (
          <Icon size={18} className={error ? 'text-danger shrink-0' : 'text-text-muted shrink-0'} />
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            'bg-transparent border-none outline-none w-full',
            'text-sm text-text-primary',
            value ? 'font-medium' : 'font-[inherit]',
            'placeholder:text-text-muted',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
      </div>
      {error && (
        <p className="text-xs text-danger mt-1 ml-1 m-0">{error}</p>
      )}
    </div>
  );
}
