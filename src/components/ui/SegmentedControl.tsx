import React from 'react';
import { cn } from '../../lib/cn';

export type SegmentedItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  items: SegmentedItem<T>[];
  /** Accent: cyan (admin), violet (school), cyan (doctor) */
  accent?: 'cyan' | 'violet' | 'emerald';
  className?: string;
};

const accentRing: Record<NonNullable<Props<string>['accent']>, string> = {
  cyan: 'border-cyan-500/35 bg-cyan-500/12 text-cyan-300',
  violet: 'border-violet-500/35 bg-violet-500/12 text-violet-300',
  emerald: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300',
};

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
  accent = 'cyan',
  className,
}: Props<T>) {
  const active = accentRing[accent];
  return (
    <div
      className={cn(
        'inline-flex w-full max-w-full flex-wrap gap-1 rounded-xl border border-slate-800/80 bg-slate-950/50 p-1',
        className
      )}
    >
      {items.map(item => {
        const isOn = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'flex min-h-[2.25rem] flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm',
              isOn
                ? active + ' shadow-sm'
                : 'border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
