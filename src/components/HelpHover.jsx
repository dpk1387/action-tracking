import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, X } from 'lucide-react';

export default function HelpHover({
  sections,
  text,
  label = 'Help',
  size = 16,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const items = sections || (text ? [{ body: text }] : []);
  if (!items.length) return null;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
      >
        <HelpCircle size={size} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute z-50 top-full left-2 mt-1 w-80 max-w-[85vw] max-h-96 overflow-y-auto rounded-xl border border-[#2a2f37] bg-[#1e2227] shadow-2xl p-3.5 text-left"
        >
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#2a2f37]">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Help & Guide</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          {items.map((s, i) => (
            <div
              key={i}
              className={i > 0 ? 'mt-2 pt-2 border-t border-[#2a2f37]' : ''}
            >
              {s.title && (
                <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-1">
                  {s.title}
                </div>
              )}
              <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {s.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
