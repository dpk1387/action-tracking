import React, { useState } from 'react';
import {
  X,
  Layers,
  ArrowRightLeft,
  Flame,
  Trophy,
  Users,
  AlertTriangle,
  Coins,
  Check,
  Plus,
  Shuffle,
  Eye,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  checkTableBalance,
  applyBalancingMoves,
  breakTablesMTT,
  bustPlayersMTT,
  getAllMTTPlayers,
  getMTTSummary,
} from '@/lib/mttStore';
import { formatPlayerTagAmount, money, formatKM } from '@/lib/poker';
import TDBustModal from './TDBustModal';
import TDBreakTableModal from './TDBreakTableModal';
import TDBalanceModal from './TDBalanceModal';

export default function MTTDirectorModal({
  mtt,
  onUpdateMTT,
  onSwitchTable,
  currentLevelInfo,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('tables'); // 'tables' | 'leaderboard' | 'busts'
  const [showBustModal, setShowBustModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  if (!mtt) return null;

  const summary = getMTTSummary(mtt);
  const balanceInfo = checkTableBalance(mtt);
  const allPlayers = getAllMTTPlayers(mtt);
  const activeTables = mtt.tables.filter((t) => t.active);

  const handleApplyBalance = () => {
    if (!balanceInfo.needsBalance) return;
    const updated = applyBalancingMoves(mtt, balanceInfo.moves);
    onUpdateMTT(updated);
  };

  const handleBustPlayers = (playerIds, eliminatorName) => {
    const updated = bustPlayersMTT(mtt, playerIds, { eliminatorName });
    onUpdateMTT(updated);
  };

  const handleBreakTables = (tableIds) => {
    const updated = breakTablesMTT(mtt, tableIds);
    onUpdateMTT(updated);
    return updated;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-[#2a2f37] bg-[#16191f] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2f37] bg-[#1a1d24]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Layers size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-white">{mtt.name || 'MTT Tournament Director'}</div>
              <div className="text-xs text-slate-400">
                {activeTables.length} active table{activeTables.length !== 1 ? 's' : ''} · {summary.remainingPlayers} remaining of {summary.totalEntries} entries
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBustModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Flame size={13} /> Bust Player(s)
            </button>
            <button
              onClick={() => setShowBreakModal(true)}
              disabled={activeTables.length <= 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
            >
              <Shuffle size={13} /> Break Table
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#2a2f37] text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Global Tournament KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 bg-[#14161c] border-b border-[#252932]">
          <div className="rounded-xl border border-[#22262f] bg-[#181c24] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
              <Users size={13} className="text-blue-400" /> Remaining Players
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {summary.remainingPlayers} <span className="text-xs text-slate-400 font-normal">/ {summary.totalEntries}</span>
            </div>
          </div>
          <div className="rounded-xl border border-[#22262f] bg-[#181c24] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
              <Coins size={13} className="text-amber-400" /> Average Stack
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatKM(summary.averageStack)}
            </div>
          </div>
          <div className="rounded-xl border border-[#22262f] bg-[#181c24] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
              <Trophy size={13} className="text-emerald-400" /> Total Chips in Play
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {formatKM(summary.totalChips)}
            </div>
          </div>
          <div className="rounded-xl border border-[#22262f] bg-[#181c24] p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
              <Layers size={13} className="text-purple-400" /> Current Level
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {currentLevelInfo || 'Level 1'}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#2a2f37] bg-[#171a21]">
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === 'tables'
                ? 'border-purple-400 text-white bg-[#1e222b]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Tables & 4-Step Balancing ({activeTables.length})
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === 'leaderboard'
                ? 'border-purple-400 text-white bg-[#1e222b]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Chip Leaderboard ({allPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('busts')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors cursor-pointer border-b-2 ${
              activeTab === 'busts'
                ? 'border-purple-400 text-white bg-[#1e222b]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Busts ({mtt.bustedPlayers?.length || 0})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'tables' && (
            <>
              {/* 4-Step Balancing Alert Card */}
              {balanceInfo.needsBalance ? (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-[#251f18] text-amber-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-amber-300">
                          Table Balancing Required (2+ Player Gap)
                        </div>
                        <div className="text-xs text-amber-200/90">{balanceInfo.message}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowBalanceModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-[#382b1d] hover:bg-[#453625] text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        View Rule Breakdown
                      </button>
                      <button
                        onClick={handleApplyBalance}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer transition-colors shadow-sm"
                      >
                        <ArrowRightLeft size={13} />
                        Execute 4-Step Balance
                      </button>
                    </div>
                  </div>

                  {/* Quick Step Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#1a1510] border border-amber-500/20">
                      <span className="font-bold text-amber-300 block mb-0.5">1. Delta:</span>
                      <span className="text-slate-300">Gap of {balanceInfo.delta} players room-wide</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1a1510] border border-amber-500/20">
                      <span className="font-bold text-amber-300 block mb-0.5">2. Giver Movers:</span>
                      <span className="text-slate-300">
                        {balanceInfo.moves.map((m) => `${m.player?.name} (Next BB)`).join(', ')}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1a1510] border border-amber-500/20">
                      <span className="font-bold text-amber-300 block mb-0.5">3. Receivers:</span>
                      <span className="text-slate-300">
                        Ranked by lowest table number ({balanceInfo.receivers?.map((r) => r.name).join(', ')})
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1a1510] border border-amber-500/20">
                      <span className="font-bold text-amber-300 block mb-0.5">4. Worst Seat:</span>
                      <span className="text-slate-300">
                        Closest clockwise to Big Blind (skipping SB & BTN)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>All tables are properly balanced according to room-wide delta rules.</span>
                  </div>
                  <button
                    onClick={() => setShowBalanceModal(true)}
                    className="text-emerald-400 hover:text-emerald-200 underline font-semibold cursor-pointer"
                  >
                    Balancing Mechanics
                  </button>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-300">Active Tables ({activeTables.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBustModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-medium cursor-pointer"
                  >
                    <Flame size={13} /> Bust Player(s)
                  </button>
                  <button
                    onClick={() => setShowBreakModal(true)}
                    disabled={activeTables.length <= 1}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-medium cursor-pointer disabled:opacity-40"
                  >
                    <Shuffle size={13} /> Break Table
                  </button>
                </div>
              </div>

              {/* Active Tables Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeTables.map((tbl) => {
                  const tblChips = tbl.players.reduce((sum, p) => sum + (Number(p.stack) || 0), 0);
                  const isCurrent = tbl.id === mtt.activeTableId;
                  return (
                    <div
                      key={tbl.id}
                      className={`rounded-xl border p-4 transition-all ${
                        isCurrent
                          ? 'border-purple-500/50 bg-[#1c1a27] shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                          : 'border-[#282d37] bg-[#171a21]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{tbl.name}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Viewing Active
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-400">
                          Total: <span className="font-bold text-amber-300">{formatKM(tblChips)}</span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                        <span>{tbl.players.length} Players Seated</span>
                        <span>Capacity: {tbl.seats || 8}</span>
                      </div>

                      {/* Players Chips List */}
                      <div className="space-y-1.5 max-h-44 overflow-y-auto mb-3 pr-1">
                        {tbl.players.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#14161d] border border-[#222631] text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-mono text-[11px] w-5">
                                #{p.seat}
                              </span>
                              <span className="font-medium text-slate-200">{p.name}</span>
                            </div>
                            <span className="font-mono text-amber-300 font-semibold">
                              {formatPlayerTagAmount(p.stack)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Table Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#252a36]">
                        {!isCurrent && (
                          <button
                            onClick={() => {
                              onSwitchTable(tbl.id);
                              onClose();
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition-colors"
                          >
                            <Eye size={13} /> Switch View to {tbl.name}
                          </button>
                        )}
                        <button
                          onClick={() => setShowBreakModal(true)}
                          disabled={activeTables.length <= 1}
                          className="px-3 py-1.5 rounded-lg bg-[#27211e] hover:bg-rose-900/40 text-amber-300 text-xs font-medium cursor-pointer disabled:opacity-40"
                        >
                          Break
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 mb-2">
                Room-wide chip standings across all active tables ({allPlayers.length} players)
              </div>
              <div className="rounded-xl border border-[#282d37] bg-[#171a21] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14161d] text-slate-400 border-b border-[#252932]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Rank</th>
                      <th className="py-2.5 px-4 font-semibold">Player</th>
                      <th className="py-2.5 px-4 font-semibold">Table & Seat</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Chips</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#232731]">
                    {allPlayers.map((p, idx) => {
                      const pct = summary.totalChips > 0 ? ((Number(p.stack) || 0) / summary.totalChips) * 100 : 0;
                      return (
                        <tr key={p.id} className="hover:bg-[#1c202a] transition-colors">
                          <td className="py-2 px-4 font-mono font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-2 px-4 font-semibold text-white">
                            {p.name}
                          </td>
                          <td className="py-2 px-4 text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-[#252b35] text-slate-300 font-mono text-[11px] mr-1">
                              {p.tableName}
                            </span>
                            Seat {p.seat}
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-amber-300">
                            {formatPlayerTagAmount(p.stack)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-400">
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'busts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">
                  Eliminated Players History ({mtt.bustedPlayers?.length || 0})
                </span>
                <button
                  onClick={() => setShowBustModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer"
                >
                  <Flame size={12} /> Record New Bust
                </button>
              </div>
              {(!mtt.bustedPlayers || mtt.bustedPlayers.length === 0) ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No eliminations recorded yet.
                </div>
              ) : (
                <div className="rounded-xl border border-[#282d37] bg-[#171a21] overflow-hidden">
                  <div className="divide-y divide-[#232731]">
                    {mtt.bustedPlayers.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 hover:bg-[#1a1e27]">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold font-mono text-xs">
                            #{b.finishRank}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-white">{b.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Eliminated from {b.tableName} · Level {b.level || 1}
                              {b.eliminatedBy && (
                                <span className="text-amber-300/80 ml-1">· Busted by {b.eliminatedBy}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-rose-300/80 bg-rose-500/10 px-2 py-1 rounded">
                          Busted
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-Modals */}
      {showBustModal && (
        <TDBustModal
          players={allPlayers}
          tables={activeTables}
          isMTT={true}
          onBust={handleBustPlayers}
          onClose={() => setShowBustModal(false)}
        />
      )}

      {showBreakModal && (
        <TDBreakTableModal
          mtt={mtt}
          onBreakTables={handleBreakTables}
          onClose={() => setShowBreakModal(false)}
        />
      )}

      {showBalanceModal && (
        <TDBalanceModal
          mtt={mtt}
          onApplyBalance={onUpdateMTT}
          onClose={() => setShowBalanceModal(false)}
        />
      )}
    </div>
  );
}
