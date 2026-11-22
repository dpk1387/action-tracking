import React from 'react';
import { X } from 'lucide-react';
import HandHistoryCard from '@/components/poker/HandHistoryCard';
import { computePlayerStats } from '@/lib/botStats';

const STAT_ROWS = [
  { key: 'vpip', label: 'VPIP' },
  { key: 'pfr', label: 'PFR' },
  { key: 'threeBet', label: '3-bet' },
  { key: 'ats', label: 'ATS' },
  { key: 'cbet', label: 'C-bet' },
  { key: 'foldToCbet', label: 'Fold to c-bet' },
  { key: 'af', label: 'AF' },
];

function statText(key, stats) {
  const v = stats[key];
  if (v == null) return '—';
  if (key === 'af') return Number.isFinite(v) ? v.toFixed(2) : '∞';
  return `${v}%`;
}

export default function BotsSessionModal({ session, onClose }) {
  if (!session) return null;
  const stats = computePlayerStats(session.handRecords, session.heroName || 'You');
  const records = session.handRecords || [];
  const outcomeLabel = session.outcome === 'win' ? 'You won' : session.outcome === 'bust' ? 'You busted' : 'Ended early';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#12161f] border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">Play Bots session</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {outcomeLabel} · {records.length} hands · {session.setup?.seats || '—'}-max · {session.setup?.difficulty || '—'} · {session.setup?.gameType === 'live' ? 'Live' : 'Online'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#1e2227] p-4">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Your stats</div>
            {stats.hands === 0 ? (
              <p className="text-xs text-slate-500">No hands recorded in this session.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {STAT_ROWS.map((row) => (
                  <div key={row.key} className="rounded-lg bg-[#15181d] border border-[#2a2f37] px-2 py-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{row.label}</div>
                    <div className="text-sm font-mono font-bold text-emerald-300">{statText(row.key, stats)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Hand history</div>
            {records.length === 0 ? (
              <p className="text-xs text-slate-500">No hands were completed.</p>
            ) : (
              <div className="space-y-3">
                {records.map((h) => (
                  <HandHistoryCard key={h.id || h.handNumber} h={h} displayUnit="chips" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
