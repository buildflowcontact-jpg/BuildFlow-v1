import { type ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: 'right' | 'top' | 'bottom' | 'left';
  disabled?: boolean;
}

/**
 * Tooltip accessible — s'affiche au survol et au focus clavier.
 * Le contenu est rendu dans un portal pour éviter tout débordement.
 */
export function Tooltip({ label, children, side = 'right', disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    if (side === 'right') {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
    } else if (side === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
    } else if (side === 'top') {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
    } else {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
    }

    setCoords({ top, left });
  }, [visible, side]);

  if (disabled) return <>{children}</>;

  const transformClass =
    side === 'right'
      ? '-translate-y-1/2'
      : side === 'left'
        ? '-translate-y-1/2 -translate-x-full'
        : side === 'top'
          ? '-translate-x-1/2 -translate-y-full'
          : '-translate-x-1/2';

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}

      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className={cn(
              'pointer-events-none fixed z-[9999] whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5',
              'text-xs font-medium text-white shadow-lg',
              'animate-in fade-in-0 zoom-in-95 duration-100',
              transformClass
            )}
          >
            {label}
          </div>,
          document.body
        )}
    </span>
  );
}
