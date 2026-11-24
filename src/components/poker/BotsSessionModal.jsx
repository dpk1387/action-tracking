import React, { useMemo, useState } from 'react';
import { Download, ExternalLink, FileSpreadsheet, Loader2, X } from 'lucide-react';
import HandHistoryCard from '@/components/poker/HandHistoryCard';
import { computePlayerStats } from '@/lib/botStats';
import { STYLE_SHORT } from '@/lib/bots';
import { exportHandsToGoogleSheet, exportHandsToCSV } from '@/lib/googleSheetsExport';

const STAT_ROWS = [
  { key: 'vpip', label: 'VPIP' },
  { key: 'pfr', label: 'PFR' },
  { key: 'rfi', label: 'RFI' },
  { key: 'limp', label: 'Limp' },
  { key: 'threeBet', label: '3-Bet' },
  { key: 'foldToThreeBet', label: 'Fold 3B' },
  { key: 'ats', label: 'ATS' },
  { key: 'foldToSteal', label: 'Fold Steal' },
  { key: 'cbet', label: 'C-Bet' },
  { key: 'foldToCbet', label: 'Fold C-Bet' },
  { key: 'af', label: 'AF' },
  { key: 'afq', label: 'AFq' },
  { key: 'wwsf', label: 'WWSF' },
  { key: 'wtsd', label: 'WTSD' },
  { key: 'wsd', label: 'W$SD' },
];

function fmt01(n) {
  const r = Math.round(Number(n) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function statText(key, stats) {
  const v = stats[key];
  if (v == null) return '—';
  if (key === 'af') return Number.isFinite(v) ? fmt01(v) : '∞';
  return `${fmt01(v)}%`;
}

export default function BotsSessionModal({ session, onClose }) {
  const [unit, setUnit] = useState('chips');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState('');

  const heroName = session?.heroName || 'You';
  const records = useMemo(() => session?.handRecords || [], [session?.handRecords]);
  const stats = useMemo(() => computePlayerStats(records, heroName), [records, heroName]);

  const botRows = useMemo(() => {
    if (!records.length) return [];
    const seen = new Map();
    (session?.seats || []).forEach((s) => {
      if (!s?.name || s.isHero || s.name === heroName) return;
      seen.set(s.name, { name: s.name, styleId: s.styleId || null });
    });
    records.forEach((rec) => {
      (rec.players || []).forEach((p) => {
        if (!p?.name || p.name === heroName || seen.has(p.name)) return;
        seen.set(p.name, { name: p.name, styleId: null });
      });
    });
    return [...seen.values()]
      .map((bot) => ({
        ...bot,
        stats: computePlayerStats(records, bot.name),
      }))
      .filter((row) => row.stats.hands > 0);
  }, [records, session?.seats, heroName]);

  if (!session) return null;
  const outcomeLabel = session.outcome === 'win' ? 'You won' : session.outcome === 'bust' ? 'You busted' : 'Ended early';
  const seatsLabel = session.setup?.seats === 2 ? 'Heads-up' : `${session.setup?.seats || '—'}-max`;
  const isLive = session.setup?.gameType === 'live';

  const handleExportCSV = () => {
    if (!records.length) {
      setExportError('No hand history available to export.');
      return;
    }
    setExportError('');
    try {
      const customName = (session.sessionName || session.name || '').trim();
      exportHandsToCSV(records, {
        filenamePrefix: customName ? customName.replace(/\s+/g, '_') : 'Play_Bots_Hand_History',
        seats: session?.seats,
        heroName,
      });
    } catch (e) {
      setExportError(e?.message || 'Failed to export CSV.');
    }
  };

  const handleExportSheets = async () => {
    if (!records.length || exporting) {
      if (!records.length) setExportError('No hand history available to export.');
      return;
    }
    setExporting(true);
    setExportError('');
    setExportResult(null);
    try {
      const dateStr = new Date(session.createdAt || Date.now()).toISOString().split('T')[0];
      const customName = (session.sessionName || session.name || '').trim();
      const title = customName
        ? `${customName} - ${dateStr}`
        : `Play Bots Hand History (${seatsLabel}) - ${dateStr}`;
      const res = await exportHandsToGoogleSheet(records, {
        title,
        sessionName: customName,
        seats: session?.seats,
        heroName,
      });
      if (res?.spreadsheetUrl) {
        setExportResult(res);
      } else {
        setExportError('Export failed – no sheet URL returned.');
      }
    } catch (e) {
      setExportError(e?.message || 'Failed to export to Google Sheets.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#12161f] border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">
              {session.sessionName || 'Play Bots session'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {session.sessionName ? 'Play Bots session · ' : ''}{outcomeLabel} · {records.length} hands · {seatsLabel} · {session.setup?.difficulty || '—'} · {isLive ? 'Live' : 'Online'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0e1219] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#181d26] p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setUnit('chips')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unit === 'chips' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Chips
            </button>
            <button
              type="button"
              onClick={() => setUnit('bb')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                unit === 'bb' ? 'bg-amber-500 text-black shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Big Blinds
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={records.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportSheets}
              disabled={exporting || records.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              {exporting ? 'Exporting...' : 'Export to Google Sheets'}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="mx-5 mt-4 text-xs text-rose-400 bg-rose-950/60 border border-rose-500/40 p-3 rounded-xl">
            {exportError}
          </div>
        )}
        {exportResult?.spreadsheetUrl && (
          <div className="mx-5 mt-4 p-3 bg-[#131c17] border border-emerald-500/50 rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-emerald-300 font-medium">
              Exported to Google Sheets ({unit === 'bb' ? 'Big Blinds' : 'Chips'})!
            </span>
            <a
              href={exportResult.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition-colors"
            >
              <ExternalLink size={13} /> Open in Google Sheets
            </a>
          </div>
        )}

        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#1e2227] p-4">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Your stats</div>
            {stats.hands === 0 ? (
              <p className="text-xs text-slate-500">No hands recorded in this session.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
                {STAT_ROWS.map((row) => (
                  <div key={row.key} className="rounded-lg bg-[#15181d] border border-[#2a2f37] px-2 py-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">{row.label}</div>
                    <div className="text-sm font-mono font-bold text-emerald-300">{statText(row.key, stats)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {botRows.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-[#1e2227] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Other players (this session)</div>
                <div className="text-[11px] text-slate-500">Only hands played in this session</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th className="py-1.5 pr-3">Bot</th>
                      <th className="py-1.5 px-2 text-right">Hands</th>
                      {STAT_ROWS.map((row) => (
                        <th key={row.key} className="py-1.5 px-2 text-right whitespace-nowrap">{row.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {botRows.map((row) => (
                      <tr key={row.name} className="border-b border-slate-800/60 last:border-b-0">
                        <td className="py-2 pr-3 font-medium text-white whitespace-nowrap">
                          <span>{row.name}</span>
                          {!isLive && row.styleId && (
                            <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                              {STYLE_SHORT[row.styleId] || row.styleId}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-300">{row.stats.hands}</td>
                        {STAT_ROWS.map((st) => (
                          <td key={st.key} className="py-2 px-2 text-right font-mono text-emerald-300 whitespace-nowrap">
                            {statText(st.key, row.stats)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Hand history</div>
            {records.length === 0 ? (
              <p className="text-xs text-slate-500">No hands were completed.</p>
            ) : (
              <div className="space-y-3">
                {records.map((h) => (
                  <HandHistoryCard key={h.id || h.handNumber} h={h} displayUnit={unit} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
