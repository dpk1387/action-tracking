import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-500 disabled:opacity-40',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';
export default Input;
