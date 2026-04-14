import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

type Props = {
  onClose: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** max-w-* tailwind */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  bodyClassName?: string;
};

const maxW: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
};

export default function ModalFrame({
  onClose,
  title,
  icon,
  children,
  size = 'lg',
  className,
  bodyClassName,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative max-h-[min(90vh,880px)] w-full overflow-y-auto rounded-2xl border border-slate-700/90 bg-slate-900 shadow-2xl',
          maxW[size],
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className={cn('p-5 pt-4', bodyClassName)}>
          <h3 className="mb-4 flex items-center gap-2 pr-8 text-lg font-bold text-white">
            {icon}
            {title}
          </h3>
          {children}
        </div>
      </div>
    </div>
  );
}
