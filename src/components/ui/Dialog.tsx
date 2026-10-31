"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/** Accessible modal built on <dialog>: focus trap, Esc to close, centred on desktop and a bottom sheet on mobile. */
export function Dialog({ open, onClose, title, description, children, dismissible = true, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; dismissible?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose(); }}
      onClick={(e) => { if (dismissible && e.target === ref.current) onClose(); }}
      aria-labelledby="dlg-title"
      aria-describedby={description ? "dlg-desc" : undefined}
      className={`m-0 mt-auto max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-surface p-0 text-ink shadow-pop sm:m-auto sm:max-h-[88vh] sm:rounded-xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
    >
      {open ? (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="dlg-title" className="text-xl">{title}</h2>
              {description ? <p id="dlg-desc" className="mt-1 text-sm text-ink-2">{description}</p> : null}
            </div>
            {dismissible ? (
              <button type="button" onClick={onClose} aria-label="Close dialog" className="grid size-8 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-slate-100"><Icon name="x" /></button>
            ) : null}
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
