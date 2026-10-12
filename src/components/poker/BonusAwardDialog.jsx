import React, { useState } from 'react';
import { rewardFor } from '@/lib/sevenTwoPatterns';

export default function BonusAwardDialog({ hand, holeCards, onConfirm, onClose, onSkip }) {
  const sg = hand.sideGames || {};
  const players = hand.players;
  const tenBB = (Number(hand.bigBlind) || 0) * 10;
  const sym = hand.currency || '';
  const hasSevenTwo = !!sg.sevenTwo;
  const hasBounty = !!sg.bounty;
  const hasMystery = !!sg.mysteryBounty;
  const anyBonus = hasSevenTwo || hasBounty || hasMystery;

  const mainWinner = hand.winners && hand.winners.find((w) => w.potIndex === 0 && w.board !== 'b');
  const mainWinnerId = mainWinner ? mainWinner.playerId : (players[0] ? players[0].id : null);
  const mainWinnerHole = mainWinnerId != null ? holeCards[mainWinnerId] : null;
  const sevenTwoDefaultAmt = hasSevenTwo
    ? (rewardFor(sg.sevenTwoRewards, mainWinnerHole, tenBB, tenBB) || tenBB)
    : 0;

  const [sevenTwoPlayer, setSevenTwoPlayer] = useState(hasSevenTwo ? mainWinnerId : null);
  const [sevenTwoAmt, setSevenTwoAmt] = useState(hasSevenTwo ? String(sevenTwoDefaultAmt || '') : '');
  const [bountyPlayer, setBountyPlayer] = useState(hasBounty ? (players[0] ? players[0].id : null) : null);
  const [bountyAmt, setBountyAmt] = useState(hasBounty ? String(sg.bountyAmount || '') : '');
  const [mysteryPlayer, setMysteryPlayer] = useState(hasMystery ? (players[0] ? players[0].id : null) : null);
  const [mysteryAmt, setMysteryAmt] = useState(hasMystery ? String(sg.mysteryAmount || '') : '');

  if (!anyBonus) return null;

  const buildBonuses = () => {
    const out = [];
    if (hasSevenTwo) {
      const amt = Number(sevenTwoAmt);
      if (sevenTwoPlayer != null && amt > 0) out.push({ type: 'sevenTwo', playerId: sevenTwoPlayer, amount: amt });
    }
    if (hasBounty) {
      const amt = Number(bountyAmt);
      if (bountyPlayer != null && amt > 0) out.push({ type: 'bounty', playerId: bountyPlayer, amount: amt });
    }
    if (hasMystery) {
      const amt = Number(mysteryAmt);
      if (mysteryPlayer != null && amt > 0) out.push({ type: 'mysteryBounty', playerId: mysteryPlayer, amount: amt });
    }
    return out;
  };

  const playerSelect = (value, onChange) => (
    <select value={value == null ? '' : value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="flex-1 rounded-md bg-[#15181d] border border-[#2a2f37] px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#4a5a4a]">
      <option value="">– select player –</option>
      {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );

  const amountInput = (value, onChange, placeholder) => (
    <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-28 rounded-md bg-[#15181d] border border-[#2a2f37] px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-600" />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-1">Bonus awards – Hand #{hand.handNumber}</h2>
        <div className="text-xs text-slate-400 mb-4">Select the player for each bonus, then confirm. Skip if no bonuses apply.</div>
        <div className="space-y-4">
          {hasSevenTwo && (
            <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
              <div className="text-sm text-slate-200 mb-1">7-2 game</div>
              <div className="text-[11px] text-slate-500 mb-2">Winner collects from every other player. Default {sym}{tenBB} (10bb).</div>
              <div className="flex items-center gap-2">
                {playerSelect(sevenTwoPlayer, setSevenTwoPlayer)}
                {amountInput(sevenTwoAmt, setSevenTwoAmt, String(tenBB || ''))}
              </div>
            </div>
          )}
          {hasBounty && (
            <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
              <div className="text-sm text-slate-200 mb-1">Bounty</div>
              <div className="text-[11px] text-slate-500 mb-2">Awarded for busting a player.</div>
              <div className="flex items-center gap-2">
                {playerSelect(bountyPlayer, setBountyPlayer)}
                {amountInput(bountyAmt, setBountyAmt, String(sg.bountyAmount || ''))}
              </div>
            </div>
          )}
          {hasMystery && (
            <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3">
              <div className="text-sm text-slate-200 mb-1">Mystery bounty</div>
              <div className="text-[11px] text-slate-500 mb-2">Drawn bounty amount awarded at the end.</div>
              <div className="flex items-center gap-2">
                {playerSelect(mysteryPlayer, setMysteryPlayer)}
                {amountInput(mysteryAmt, setMysteryAmt, String(sg.mysteryAmount || ''))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onSkip} className="flex-1 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm py-2.5">Skip</button>
          <button onClick={() => onConfirm(buildBonuses())} className="flex-1 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5">Confirm bonuses</button>
        </div>
      </div>
    </div>
  );
}
