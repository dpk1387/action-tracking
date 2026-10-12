import React, { useState } from 'react';
import { rewardFor } from '@/lib/sevenTwoPatterns';

export default function SevenTwoAward({ hand, holeCards, onAward, onSkip, foldWinnerId, preselectId }) {
  const sg = hand.sideGames || {};
  const players = hand.players;
  const tenBB = (Number(hand.bigBlind) || 0) * 10;
  const sym = hand.currency || '';

  const [playerId, setPlayerId] = useState(preselectId != null ? preselectId : null);
  const [amount, setAmount] = useState(() => {
    if (preselectId != null) {
      const r = rewardFor(sg.sevenTwoRewards, holeCards[preselectId], tenBB, tenBB);
      return r != null ? String(r) : String(tenBB || '');
    }
    return String(tenBB || '');
  });

  const defaultFor = (pid) => {
    const hole = pid != null ? holeCards[pid] : null;
    const r = rewardFor(sg.sevenTwoRewards, hole, tenBB, tenBB);
    return r != null ? String(r) : String(tenBB || '');
  };

  const select = (pid) => {
    setPlayerId(pid);
    setAmount(defaultFor(pid));
  };

  const confirm = () => {
    const amt = Number(amount);
    if (playerId == null || !(amt > 0)) return;
    onAward({ type: 'sevenTwo', playerId, amount: amt });
  };

  const giveFoldReward = () => {
    const pid = foldWinnerId;
    if (pid == null) return;
    onAward({ type: 'sevenTwo', playerId: pid, amount: tenBB });
  };

  if (foldWinnerId != null) {
    const winner = hand.players.find((p) => p.id === foldWinnerId);
    return (
      <div className="mt-3 rounded-lg border border-[#3a4a3a] bg-[#15181d] p-3">
        <div className="text-sm text-slate-200 mb-1">7-2 game</div>
        <div className="text-[11px] text-slate-500 mb-2">
          {winner?.name || 'Winner'} won by folding everyone out. Give them the 7-2 reward ({sym}{tenBB || '10bb'} from each other player)?
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={giveFoldReward} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-1.5 cursor-pointer">
            Give reward
          </button>
          <button onClick={onSkip} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 py-1.5 cursor-pointer">
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-[#3a4a3a] bg-[#15181d] p-3">
      <div className="text-sm text-slate-200 mb-1">7-2 game</div>
      <div className="text-[11px] text-slate-500 mb-2">
        Pick the player who won with a 7-2. The reward is collected from every other player. Blank reward defaults to {sym}{tenBB || '10bb'}.
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={playerId == null ? '' : playerId}
          onChange={(e) => select(e.target.value ? Number(e.target.value) : null)}
          className="flex-1 min-w-[160px] rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#4a5a4a]"
        >
          <option value="">– no 7-2 winner –</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(tenBB || '')}
          className="w-28 rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-600"
        />
        <button
          onClick={confirm}
          disabled={playerId == null || !(Number(amount) > 0)}
          className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Award 7-2
        </button>
        <button onClick={onSkip} className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 py-1.5 cursor-pointer">
          Skip
        </button>
      </div>
    </div>
  );
}
