import React, { useState } from 'react';
import { X } from 'lucide-react';
import { money } from '@/lib/poker';

export default function RebuyDialog({ players, rebuyChips, rebuyPrice, allowAddOn, addOnChips, addOnPrice, currency, onRebuy, onAddOn, onClose }) {
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState('rebuy');
  const sym = currency || '';
  const busted = (players || []).filter((p) => p.stack <= 0);
  const list = mode === 'rebuy' ? busted : (players || []);
  const chips = mode === 'rebuy' ? rebuyChips : addOnChips;
  const price = mode === 'rebuy' ? rebuyPrice : addOnPrice;

  const submit = () => {
    if (!selectedId) return;
    if (mode === 'rebuy') onRebuy(Number(selectedId), chips);
    else onAddOn(Number(selectedId), addOnChips);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Re-buy / Add-on</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex rounded-lg border border-[#2a2f37] overflow-hidden mb-4">
          <button
            onClick={() => { setMode('rebuy'); setSelectedId(''); }}
            className={`flex-1 px-3 py-2 text-xs ${mode === 'rebuy' ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}
          >
            Re-buy (busted)
          </button>
          {allowAddOn && (
            <button
              onClick={() => { setMode('addon'); setSelectedId(''); }}
              className={`flex-1 px-3 py-2 text-xs ${mode === 'addon' ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}
            >
              Add-on (anyone)
            </button>
          )}
        </div>
        <div className="text-xs text-slate-400 mb-3">
          {mode === 'rebuy'
            ? `Adds ${money(chips, sym)} chips${price != null ? ` for ${money(price, sym)}` : ''}.`
            : `Adds ${money(addOnChips, sym)} chips${addOnPrice != null ? ` for ${money(addOnPrice, sym)}` : ''}.`}
        </div>
        {list.length === 0 ? (
          <div className="text-sm text-slate-400 mb-4">
            {mode === 'rebuy' ? 'No busted players right now.' : 'No players at the table.'}
          </div>
        ) : (
          <>
            <label className="text-xs text-slate-400 block mb-1">Select player</label>
            <div className="space-y-1.5 mb-4">
              {list.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedId === p.id
                      ? 'bg-[#4a5a4a] border-[#5a6a5a] text-white'
                      : 'bg-[#15181d] border-[#2a2f37] text-slate-300 hover:border-[#3a4a3a]'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-slate-400">{money(p.stack, sym)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={submit}
          disabled={!selectedId}
          className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {mode === 'rebuy' ? 'Re-buy' : 'Add on'}
        </button>
      </div>
    </div>
  );
}
