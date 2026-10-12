import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function BlindLevelDialog({ smallBlind, bigBlind, anteAmount, anteType, onSave, onClose }) {
  const [sb, setSb] = useState(smallBlind);
  const [bb, setBb] = useState(bigBlind);
  const [ante, setAnte] = useState(anteAmount);
  const [error, setError] = useState('');
  const isBBA = anteType === 'bba';

  useEffect(() => { if (isBBA) setAnte(Number(bb)); }, [isBBA, bb]);

  const save = () => {
    if (Number(sb) <= 0 || Number(bb) <= 0) return setError('Blinds must be positive.');
    if (anteType !== 'none' && Number(ante) <= 0) return setError('Ante must be positive.');
    onSave(Number(sb), Number(bb), Number(ante));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Next blind level</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Small blind</label>
            <input type="number" value={sb} onChange={(e) => setSb(e.target.value)} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Big blind</label>
            <input type="number" value={bb} onChange={(e) => setBb(e.target.value)} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
          </div>
          {anteType !== 'none' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">Ante amount {isBBA && '(= big blind)'}</label>
              <input type="number" value={ante} disabled={isBBA} onChange={(e) => setAnte(e.target.value)} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm disabled:opacity-40" />
            </div>
          )}
        </div>
        {error && <div className="text-sm text-rose-400 mt-3">{error}</div>}
        <button onClick={save} className="w-full mt-4 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5">Apply level</button>
      </div>
    </div>
  );
}
