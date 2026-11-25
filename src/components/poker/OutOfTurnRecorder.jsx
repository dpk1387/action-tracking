import React, { useState, useEffect } from 'react';
import { money, parseAmount, getOotAggressiveLevel } from '@/lib/poker';

export default function OutOfTurnRecorder({ hand, onFoldOutOfTurn, onRecordOutOfTurn }) {
  const [open, setOpen] = useState(false);
  const [selId, setSelId] = useState('');
  const [kind, setKind] = useState('');
  const [amount, setAmount] = useState('');
  const [logged, setLogged] = useState(null);

  useEffect(() => { setOpen(false); setSelId(''); setKind(''); setAmount(''); setLogged(null); }, [hand?.handNumber, hand?.street]);
  useEffect(() => { if (!open) { setKind(''); setAmount(''); setLogged(null); } }, [open, selId]);

  // Desktop 'O' shortcut to toggle the Out of Turn action menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'o' || e.key === 'O') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!hand || hand.phase !== 'playing' || hand.currentPlayer < 0) return null;

  const eligible = hand.players.filter((p) => p.status !== 'folded' && hand.players[hand.currentPlayer]?.id !== p.id);
  if (eligible.length === 0) return null;

  const cur = hand.currency;
  const cp = hand.players[hand.currentPlayer];

  const submit = () => {
    if (!selId || !kind) return;
    const p = hand.players.find((pl) => pl.id === Number(selId));
    if (!p) return;
    if (kind === 'muck') {
      onFoldOutOfTurn(p.id);
      setLogged(`${p.name} mucked (folded out of turn)`);
    } else if (kind === 'passive') {
      if (onRecordOutOfTurn) onRecordOutOfTurn(p.id, 'passive');
      setLogged(`${p.name} OOT: check/call (binding if action unchanged)`);
    } else if (kind === 'aggressive') {
      const parsed = parseAmount(amount);
      if (parsed == null || parsed <= 0) return;
      if (onRecordOutOfTurn) onRecordOutOfTurn(p.id, 'aggressive', parsed);
      const lvl = getOotAggressiveLevel(hand, parsed);
      const tier = lvl <= 1 ? 'bet' : lvl === 2 ? 'raise' : `${lvl}-bet`;
      const sep = lvl >= 2 ? 'to ' : '';
      setLogged(`${p.name} OOT: ${tier} ${sep}${money(parsed, cur)} (binding if action unchanged)`);
    }
    setKind('');
    setAmount('');
  };

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1a1d22] p-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left cursor-pointer"
      >
        <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>Out of turn action</span>
          <span className="hidden sm:inline-block px-1.5 py-0.2 bg-[#2a2f37] border border-[#3b434e] text-slate-300 rounded text-[10px] font-mono">O</span>
        </span>
        <span className="text-xs text-slate-500">{open ? '– hide' : '+ record'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="text-[11px] text-slate-500">
            Action stays on <span className="text-slate-300 font-medium">{cp.name}</span>. OOT action is binding if the skipped action doesn't change.
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={selId}
              onChange={(e) => setSelId(e.target.value)}
              className="rounded-lg bg-[#15181d] border border-[#2a2f37] px-2 py-1.5 text-white text-sm"
            >
              <option value="">Select player…</option>
              {eligible.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <button
                onClick={() => setKind('passive')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  kind === 'passive' ? 'bg-[#4a5a4a] text-white' : 'bg-[#2a2f37] text-slate-300 hover:bg-[#363c45]'
                }`}
              >
                Check/Call
              </button>
              <button
                onClick={() => setKind('aggressive')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  kind === 'aggressive' ? 'bg-[#7a4a3a] text-white' : 'bg-[#2a2f37] text-slate-300 hover:bg-[#363c45]'
                }`}
              >
                Bet/Raise
              </button>
              <button
                onClick={() => setKind('muck')}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  kind === 'muck' ? 'bg-[#c94c4c] text-white' : 'bg-[#2a2f37] text-slate-300 hover:bg-[#363c45]'
                }`}
              >
                Muck
              </button>
            </div>
            {kind === 'aggressive' && (
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Chips"
                className="w-28 rounded-lg bg-[#15181d] border border-[#2a2f37] px-2 py-1.5 text-white text-sm"
              />
            )}
            <button
              onClick={submit}
              disabled={!selId || !kind || (kind === 'aggressive' && (!parseAmount(amount) || parseAmount(amount) <= 0))}
              className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-1.5 disabled:opacity-30 cursor-pointer"
            >
              Record
            </button>
          </div>
          {logged && (
            <div className="rounded-lg bg-[#3a3320] border border-[#6b5a2a] px-3 py-1.5 text-xs text-amber-300/90">
              {logged}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
