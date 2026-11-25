import React, { useState } from 'react';
import { X, Trash2, FileSpreadsheet, Calendar, Spade, Trophy } from 'lucide-react';
import HandHistoryCard from '@/components/poker/HandHistoryCard';
import { exportHandsToGoogleSheet, exportHandsToCSV } from '@/lib/googleSheetsExport';
import { downloadPokerStarsTxt } from '@/lib/pokerStarsExport';
import { Download } from 'lucide-react';

export default function CompletedSessionModal({ session, onClose, onDelete }) {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState('');

  if (!session) return null;

  const hands = session.hands || [];
  const sessionTitle = session.sessionName || session.title || 'Completed Session';
  const completedDate = session.completedAt ? new Date(session.completedAt).toLocaleString() : '';

  const handleExport = async () => {
    if (!hands || hands.length === 0) {
      setExportError('No hand history available to export.');
      return;
    }
    setExporting(true);
    setExportError('');
    setExportResult(null);
    try {
      const res = await exportHandsToGoogleSheet(hands, { hideAmounts: Boolean(session.hideAmounts) });
      setExportResult(res);
    } catch (e) {
      setExportError(e?.message || 'Failed to export to Google Sheets.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTxt = () => {
    if (!hands.length) {
      setExportError('No hand history available to export.');
      return;
    }
    setExportError('');
    try {
      downloadPokerStarsTxt(hands, {
        sessionKey: session.sessionName || session.title || 'Session',
        heroName: 'You',
      });
    } catch (e) {
      setExportError(e?.message || 'Export to .txt failed.');
    }
  };

  const handleExportCSV = () => {
    if (!hands || hands.length === 0) {
      setExportError('No hand history available to export.');
      return;
    }
    try {
      exportHandsToCSV(hands, { hideAmounts: Boolean(session.hideAmounts) });
    } catch (e) {
      setExportError(e?.message || 'Failed to export CSV.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#141820] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-[#181d27]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {session.mode === 'tournament' ? (
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded">
                  <Trophy size={12} /> Tournament
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2 py-0.5 rounded">
                  <Spade size={12} /> Cash Game
                </span>
              )}
              <h2 className="text-lg font-bold text-white truncate">{sessionTitle}</h2>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
              {completedDate && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-slate-500" /> Completed: {completedDate}
                </span>
              )}
              <span>{hands.length} Hand{hands.length === 1 ? '' : 's'} recorded</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-[#12151c] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportTxt}
              disabled={hands.length === 0}
              title="Download a PokerStars-format .txt hand history"
              className="px-3.5 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              <Download size={14} />
              Export .txt
            </button>
            <button
              onClick={handleExportCSV}
              disabled={hands.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || hands.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow"
            >
              <FileSpreadsheet size={14} />
              {exporting ? 'Exporting...' : 'Export to Google Sheet'}
            </button>
          </div>

          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this completed session?')) {
                  onDelete(session.id);
                  onClose();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 size={14} /> Delete Session
            </button>
          )}
        </div>

        {/* Export Feedback Messages */}
        {exportResult && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-2">
            <span>Successfully exported to Google Sheets!</span>
            {exportResult.spreadsheetUrl && (
              <a
                href={exportResult.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold text-white hover:text-emerald-300"
              >
                Open Google Sheet →
              </a>
            )}
          </div>
        )}
        {exportError && (
          <div className="mx-5 mt-3 p-3 rounded-lg bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs">
            {exportError}
          </div>
        )}

        {/* Main Hand History List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {hands.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No hands were recorded for this completed session.
            </div>
          ) : (
            hands.map((h, i) => (
              <HandHistoryCard key={h.handNumber || i} h={h} hideAmounts={Boolean(session.hideAmounts)} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#181d27] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
