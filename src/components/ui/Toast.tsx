"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./Icon";

type Ctx = { toast: (message: string, kind?: "success" | "error") => void };
const ToastContext = createContext<Ctx>({ toast: () => undefined });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((text: string, kind: "success" | "error" = "success") => {
    clearTimeout(timer.current);
    setMsg({ text, kind });
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4 md:bottom-8">
        {msg ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-md bg-sidebar px-4 py-3 text-sm text-white shadow-pop">
            <Icon name={msg.kind === "success" ? "circle-check" : "circle-alert"} className={msg.kind === "success" ? "text-emerald-400" : "text-rose-400"} />
            {msg.text}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
