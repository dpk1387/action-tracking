import React, { useState, useEffect } from 'react';

let listeners = [];
let memoryToasts = [];

export function toast({ title, description, variant }) {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { id, title, description, variant };
  memoryToasts = [...memoryToasts, newToast];
  listeners.forEach((l) => l(memoryToasts));
  setTimeout(() => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l(memoryToasts));
  }, 4000);
  return { id };
}

export function useToast() {
  const [toasts, setToasts] = useState(memoryToasts);
  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);
  return {
    toasts,
    toast,
    dismiss: (id) => {
      memoryToasts = memoryToasts.filter((t) => t.id !== id);
      listeners.forEach((l) => l(memoryToasts));
    },
  };
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`p-3 rounded-lg border shadow-lg flex items-start justify-between text-sm ${
            t.variant === 'destructive'
              ? 'bg-[#3a2020] border-[#c94c4c] text-rose-200'
              : 'bg-[#1e2227] border-[#2a2f37] text-white'
          }`}
        >
          <div>
            {t.title && <div className="font-semibold">{t.title}</div>}
            {t.description && <div className="text-xs text-slate-300 mt-0.5">{t.description}</div>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
