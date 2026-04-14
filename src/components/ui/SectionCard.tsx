import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

type Props = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Denser header for clinical stacks */
  dense?: boolean;
};

export default function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  className,
  dense,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800/80 bg-slate-900/70 shadow-sm backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between text-left transition-colors hover:bg-slate-800/40',
          dense ? 'px-4 py-2.5' : 'px-4 py-3'
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate text-sm font-semibold text-slate-100">{title}</span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-500" />
        )}
      </button>
      {open && (
        <div className={cn('border-t border-slate-800/60 px-4 pb-4', dense ? 'pt-3' : 'pt-3.5')}>
          {children}
        </div>
      )}
    </div>
  );
}
