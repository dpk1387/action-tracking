import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn('text-xs text-slate-400 block font-medium select-none', className)}
      {...props}
    />
  );
});
Label.displayName = 'Label';
export default Label;
