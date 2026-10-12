import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { STREET_LABEL } from '@/lib/poker';

export default function ActionHistory({ history = [], hideAmounts }) {
  const [collapsed, setCollapsed] = useState(true);
  const rows = history || [];

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-white mb-1 cursor-pointer hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>Action history</span>
          <span className="text-xs font-normal text-slate-400">({rows.length})</span>
        </span>
        {collapsed ? (
          <ChevronDown size={16} className="text-slate-400" />
        ) : (
          <ChevronUp size={16} className="text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="max-h-48 overflow-y-auto mt-2">
          {rows.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">
              No actions yet. Player actions will appear here.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-500 sticky top-0 bg-[#1e2227]">
                <tr>
                  <th className="text-left font-medium pb-1">Street</th>
                  <th className="text-left font-medium pb-1">Player</th>
                  <th className="text-left font-medium pb-1">Action</th>
                  <th className="text-right font-medium pb-1">Chips</th>
                  <th className="text-right font-medium pb-1">Pot</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={i} className="text-slate-300 border-t border-[#2a2f37]/50">
                    <td className="py-1">{STREET_LABEL[a.street]}</td>
                    <td className="py-1">{a.player}</td>
                    <td className="py-1">{a.action}</td>
                    <td className="py-1 text-right">{hideAmounts ? '—' : (a.chips || '')}</td>
                    <td className="py-1 text-right">{hideAmounts ? '—' : a.pot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
