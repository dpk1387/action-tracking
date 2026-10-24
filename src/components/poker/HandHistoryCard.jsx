import React from 'react';
import { money, SUIT_SYMBOL, SUIT_RED, rankDisplay } from '@/lib/poker';

const STREETS = ['preflop', 'flop', 'turn', 'river'];

function MiniCard({ card }) {
  if (card.hidden) return (
    <span className="inline-flex items-center justify-center w-6 h-8 rounded bg-[#3a4a3a] border border-[#4a5a4a] text-[11px] text-[#7fae7f] mr-0.5">?</span>
  );
  const red = SUIT_RED[card.suit];
  return (
    <span className={`inline-flex items-center justify-center w-6 h-8 rounded bg-slate-100 text-[11px] font-bold mr-0.5 ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      {rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}
    </span>
  );
}

export default function HandHistoryCard({ h }) {
  const cur = h.currency;
  const byStreet = {};
  STREETS.forEach((s) => { byStreet[s] = {}; });
  (h.actions || []).forEach((a) => {
    if (!byStreet[a.street]) byStreet[a.street] = {};
    const label = a.chips ? `${a.action} ${money(a.chips, cur)}` : a.action;
    byStreet[a.street][a.player] = byStreet[a.street][a.player]
      ? `${byStreet[a.street][a.player]} → ${label}`
      : label;
  });
  const won = {};
  (h.winners || []).forEach((w) => { won[w.playerId] = (won[w.playerId] || 0) + w.amount; });
  const boardByStreet = {};
  const comm = h.communityCards || [];
  if (comm.length >= 3) boardByStreet.flop = comm.slice(0, 3);
  if (comm.length >= 4) boardByStreet.turn = comm.slice(3, 4);
  if (comm.length >= 5) boardByStreet.river = comm.slice(4, 5);

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-semibold">Hand #{h.handNumber}</div>
        <div className="text-xs text-slate-400">
          Blinds {money(h.smallBlind, cur)} / {money(h.bigBlind, cur)}
          {h.anteType === 'three_blinds' ? ` · 3B ${money(h.thirdBlind || (h.bigBlind * 2), cur)}` : h.anteType === 'bba' ? ` · BBA ${money(h.anteAmount || h.bigBlind, cur)}` : h.anteType === 'btn_ante' ? ` · BTN Ante ${money(h.anteAmount || h.bigBlind, cur)}` : h.anteType === 'sb_half_ante' ? ` · SB 1/2 Ante ${money(h.anteAmount || Math.round(h.bigBlind * 0.5), cur)}` : h.anteType === 'traditional' ? ` · Ante ${money(h.anteAmount, cur)}` : ''}
          {h.bombPot ? ' · Bomb pot' : ''}
          {h.killPot ? (h.halfKill ? ' · Half-kill' : ' · Kill pot') : ''}
        </div>
      </div>
      {h.notes && h.notes.length > 0 && (
        <div className="mb-3 space-y-1 rounded-md bg-[#15181d] border border-[#2a2f37] p-2">
          {h.notes.map((n, i) => (
            <div key={i} className="text-xs text-amber-300/90">{n}</div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {['flop', 'turn', 'river'].map((s) => boardByStreet[s] ? (
          <div key={s} className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 capitalize">{s}:</span>
            {boardByStreet[s].map((c, i) => <MiniCard key={i} card={c} />)}
          </div>
        ) : null)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 border-b border-[#2a2f37]">
              <th className="py-1.5 pr-2">Player</th>
              {STREETS.map((s) => <th key={s} className="py-1.5 px-2 capitalize">{s}</th>)}
              <th className="py-1.5 px-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {(h.players || []).map((p) => (
              <tr key={p.id} className="border-b border-[#15181d] align-top">
                <td className="py-1.5 pr-2">
                  <div className="text-white font-medium">{p.name}</div>
                  <div className="text-[10px] text-slate-500">{p.position} · {money(p.stack, cur)}</div>
                </td>
                {STREETS.map((s) => (
                  <td key={s} className="py-1.5 px-2 text-slate-300 text-xs whitespace-nowrap">
                    {byStreet[s]?.[p.name] || <span className="text-slate-600">—</span>}
                  </td>
                ))}
                <td className="py-1.5 px-2">
                  {won[p.id]
                    ? <span className="text-emerald-300 font-semibold text-xs">+{money(won[p.id], cur)}</span>
                    : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
