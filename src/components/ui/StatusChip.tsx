import React from 'react';
import { cn } from '../../lib/cn';

export type StatusVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted';

const variants: Record<StatusVariant, string> = {
  neutral: 'border-slate-600/50 bg-slate-800/60 text-slate-200',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  success: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/35 bg-red-500/10 text-red-300',
  muted: 'border-slate-700 bg-slate-800/40 text-slate-400',
};

type Props = {
  children: React.ReactNode;
  variant?: StatusVariant;
  className?: string;
  size?: 'sm' | 'md';
};

export default function StatusChip({ children, variant = 'neutral', className, size = 'sm' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-md border font-medium tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-[10px] uppercase tracking-wide' : 'px-2.5 py-1 text-xs',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
