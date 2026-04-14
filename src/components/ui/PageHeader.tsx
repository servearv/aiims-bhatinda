import React from 'react';
import { cn } from '../../lib/cn';

type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Hide bottom margin when glued to segmented control */
  className?: string;
  dense?: boolean;
};

export default function PageHeader({ title, description, actions, className, dense }: Props) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', dense ? 'mb-3' : 'mb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
