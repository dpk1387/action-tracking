import React from 'react';
import { money, SUIT_SYMBOL, SUIT_RED, rankDisplay } from '@/lib/poker';
import { sortGoHoleCards } from '@/lib/goMode';

const STREETS = ['preflop', 'flop', 'turn', 'river'];

function MiniCard({ card }) {
  if (card.hidden) return (
    <span className="inline-flex items-center justify-center w-6 h-8 rounded bg-[#3a4a3a] border border-[#4a5a4a] text-[11px] text-[#7fae7f] mr-0.5">?</span>
  );
  const red = SUIT_RED[card.suit];
  return (
    <span className={`inline-flex items-center justify-center w-6 h-8 rounded bg-slate-100 text-[11px] font-bold mr-0.5 shadow-sm ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <strong className="font-bold">{rankDisplay(card.rank)}</strong>
      <span>{SUIT_SYMBOL[card.suit]}</span>
    </span>
  );
}

export default function HandHistoryCard({ h, displayUnit = 'chips' }) {
  const isBB = displayUnit === 'bb';
  const bb = Number(h.bigBlind) || 1;
  const fmtVal = (val) => {
    if (val == null) return '';
    const v = Number(val) / bb;
    return Number.isInteger(v) ? `${v}` : v.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1');
  };

  const cur = isBB ? '' : h.currency;
  const byStreet = {};
  STREETS.forEach((s) => { byStreet[s] = {}; });
  (h.actions || []).forEach((a) => {
    if (!byStreet[a.street]) byStreet[a.street] = {};
    const amtStr = a.chips ? ` ${isBB ? fmtVal(a.chips) : money(a.chips, cur)}` : '';
    const label = `${a.action}${amtStr}`.trim();
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

  const holeCardsMap = h.holeCards || h._holeCards || {};

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-semibold text-white">Hand #{h.handNumber}</div>
        <div className="text-xs text-slate-400">
          Blinds {money(h.smallBlind, h.currency)} / {money(h.bigBlind, h.currency)}
          {h.anteType === 'three_blinds' ? ` · 3B ${money(h.thirdBlind || (h.bigBlind * 2), h.currency)}` : h.anteType === 'bba' ? ` · BBA ${money(h.anteAmount || h.bigBlind, h.currency)}` : h.anteType === 'btn_ante' ? ` · BTN Ante ${money(h.anteAmount || h.bigBlind, h.currency)}` : h.anteType === 'sb_half_ante' ? ` · BB 1/2 Ante ${money(h.anteAmount || Math.round(h.bigBlind * 0.5), h.currency)}` : h.anteType === 'traditional' ? ` · Ante ${money(h.anteAmount, h.currency)}` : ''}
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
            {(h.players || []).map((p) => {
              const rawHoles = (holeCardsMap[p.id] ?? holeCardsMap[String(p.id)]) || p.holeCards || [];
              const pHoles = sortGoHoleCards(rawHoles);
              return (
                <tr key={p.id} className="border-b border-[#15181d] align-top">
                  <td className="py-1.5 pr-2">
                    <div className="text-white font-medium flex items-center gap-1.5 flex-wrap">
                      <span>{p.name}</span>
                      {pHoles.length > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          {pHoles.map((c, ci) => <MiniCard key={ci} card={c} />)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {p.position} · {isBB ? `${fmtVal(p.stack)} BB` : money(p.stack, cur)}
                    </div>
                  </td>
                  {STREETS.map((s) => (
                    <td key={s} className="py-1.5 px-2 text-slate-300 text-xs whitespace-nowrap">
                      {byStreet[s]?.[p.name] || <span className="text-slate-600">—</span>}
                    </td>
                  ))}
                  <td className="py-1.5 px-2">
                    {(() => {
                      let net = 0;
                      if (p.endStack != null && p.initialStack != null && p.endStack !== p.initialStack) {
                        net = p.endStack - p.initialStack;
                      } else if (won[p.id] || p.totalBet) {
                        net = (won[p.id] || 0) - (p.totalBet || 0);
                      }
                      if (net > 0) {
                        return <span className="text-emerald-300 font-semibold text-xs">+{isBB ? `${fmtVal(net)} BB` : money(net, cur)}</span>;
                      } else if (net < 0) {
                        return <span className="text-rose-400 font-semibold text-xs">-{isBB ? `${fmtVal(Math.abs(net))} BB` : money(Math.abs(net), cur)}</span>;
                      } else {
                        return <span className="text-slate-600">—</span>;
                      }
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
