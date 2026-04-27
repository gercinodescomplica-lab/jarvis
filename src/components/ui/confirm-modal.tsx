'use client';
import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

type Variant = 'danger' | 'warning';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_CONFIG: Record<Variant, { icon: React.ReactNode; confirmClass: string; iconBg: string }> = {
  danger: {
    icon: <Trash2 size={22} />,
    iconBg: 'bg-rose-500/15 text-rose-500',
    confirmClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30',
  },
  warning: {
    icon: <AlertTriangle size={22} />,
    iconBg: 'bg-amber-500/15 text-amber-500',
    confirmClass: 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/30',
  },
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cfg = VARIANT_CONFIG[variant];
  const cancelRef = useRef<HTMLButtonElement>(null);

  // focus trap — foca no cancelar ao abrir
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // fecha com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">

        {/* Top accent line */}
        <div className={`h-0.5 w-full ${variant === 'danger' ? 'bg-rose-500' : 'bg-amber-500'}`} />

        <div className="p-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground leading-snug">{title}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={onCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60" />

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              ref={cancelRef}
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-all disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[90px] flex items-center justify-center gap-2 ${cfg.confirmClass}`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
