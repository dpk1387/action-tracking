import * as React from 'react';
import { cn } from '@/lib/utils';

export const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    let base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    let variantClasses = 'bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white';
    if (variant === 'outline') {
      variantClasses = 'border border-[#2a2f37] bg-[#15181d] hover:bg-[#1e2227] text-white';
    } else if (variant === 'destructive') {
      variantClasses = 'bg-[#c94c4c] hover:bg-[#d95959] text-white';
    } else if (variant === 'ghost') {
      variantClasses = 'bg-transparent hover:bg-[#2a2f37] text-slate-300';
    } else if (variant === 'secondary') {
      variantClasses = 'bg-[#2a2f37] hover:bg-[#363c45] text-white';
    }

    let sizeClasses = 'h-10 px-4 py-2 text-sm';
    if (size === 'sm') sizeClasses = 'h-8 px-3 text-xs';
    if (size === 'lg') sizeClasses = 'h-12 px-6 text-base';
    if (size === 'icon') sizeClasses = 'h-9 w-9 p-0';

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(base, variantClasses, sizeClasses, className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
export default Button;
