import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-gradient-brand text-white shadow-sm hover:shadow-glow hover:brightness-[1.04]',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 ease-smooth',
          'active:scale-[0.97]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
