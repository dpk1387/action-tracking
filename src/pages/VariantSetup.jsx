import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Check, Shield } from 'lucide-react';
import { useSession, sessionStore } from '@/lib/sessionStore';
import { VARIANTS, GAME_TYPES } from '@/lib/poker';

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#2a2f37]/60">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-slate-400">{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
          checked ? 'bg-[#4a5a4a]' : 'bg-[#2a2f37]'
        }`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </div>
  );
}

export default function VariantSetup() {
  const session = useSession();
  const navigate = useNavigate();
  const hand = session.hand;
  const config = session.config || {};
  const isTournament = (hand?.mode || config?.mode || session?.mode) === 'tournament';

  const [variant, setVariant] = useState(hand?.variant || config?.variant || 'nlh');
  const [gameType, setGameType] = useState(hand?.gameType || config?.gameType || 'nl');
  const [doubleBoard, setDoubleBoard] = useState(!!(hand?.doubleBoard ?? config?.doubleBoard));

  // Side games (cash game only)
  const sg = hand?.sideGames || config?.sideGames || {};
  const [bombPot, setBombPot] = useState(!!(hand?.bombPot ?? config?.bombPot));
  const [bombAmount, setBombAmount] = useState(hand?.bombAmount ?? config?.bombAmount ?? (hand?.bigBlind ? hand.bigBlind * 2 : 100));

  const [killType, setKillType] = useState(sg.halfKill ? 'half' : sg.killPot ? 'full' : 'none');
  const [sevenTwo, setSevenTwo] = useState(!!sg.sevenTwo);
  const [sevenTwoAmount, setSevenTwoAmount] = useState(sg.sevenTwoRewards?.amount ?? (hand?.bigBlind ? hand.bigBlind * 10 : 20));
  const [sevenTwoSuited, setSevenTwoSuited] = useState(sg.sevenTwoRewards?.suited ?? '');

  const [standUp, setStandUp] = useState(!!sg.standUp);
  const [standUpPenalty, setStandUpPenalty] = useState(sg.standUpPenalty ?? (hand?.bigBlind ? hand.bigBlind * 5 : 50));

  // Straddle options (cash game only)
  const [allowStraddle, setAllowStraddle] = useState(!!(hand?.allowStraddle ?? config?.allowStraddle));
  const [allowMultiStraddle, setAllowMultiStraddle] = useState(!!(hand?.allowMultiStraddle ?? config?.allowMultiStraddle));
  const [mandatoryStraddle, setMandatoryStraddle] = useState(!!(hand?.mandatoryStraddle ?? config?.mandatoryStraddle));

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    const updatedSideGames = {
      ...sg,
      killPot: !isTournament && killType === 'full',
      halfKill: !isTournament && killType === 'half',
      sevenTwo: !isTournament && sevenTwo,
      sevenTwoRewards: (!isTournament && sevenTwo)
        ? {
            amount: Number(sevenTwoAmount) || 0,
            suited: sevenTwoSuited !== '' ? Number(sevenTwoSuited) : undefined,
          }
        : sg.sevenTwoRewards,
      bounty: sg.bounty,
      bountyAmount: sg.bountyAmount,
      mysteryBounty: sg.mysteryBounty,
      mysteryAmount: sg.mysteryAmount,
      standUp: !isTournament && standUp,
      standUpPenalty: !isTournament ? (Number(standUpPenalty) || 0) : sg.standUpPenalty,
    };

    const patch = {
      variant,
      gameType,
      doubleBoard,
      bombPot: !isTournament && bombPot,
      bombAmount: !isTournament ? (Number(bombAmount) || 0) : 0,
      sideGames: updatedSideGames,
      allowStraddle: !isTournament && allowStraddle,
      allowMultiStraddle: !isTournament && allowMultiStraddle,
      mandatoryStraddle: !isTournament && mandatoryStraddle,
      killActive: !isTournament && killType !== 'none',
      killType: killType === 'half' ? 'half' : 'kill',
    };

    sessionStore.set((prev) => ({
      ...prev,
      config: { ...prev.config, ...patch },
      hand: prev.hand ? { ...prev.hand, ...patch } : null,
    }));

    setSavedSuccess(true);
    setTimeout(() => {
      navigate('/');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#121417] text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold">Variant & Side Games Setup</h1>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white font-medium cursor-pointer transition-colors"
          >
            {savedSuccess ? <Check size={16} /> : <Save size={16} />}
            {savedSuccess ? 'Saved!' : 'Save changes'}
          </button>
        </div>

        {/* Game Variant & Limits */}
        <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-4">
          <h2 className="text-base font-semibold text-emerald-300">Poker Game Variant & Limit</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Game Variant</label>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
              >
                {Object.entries(VARIANTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label} ({v.holeSize} hole cards)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Betting Structure</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
              >
                {Object.entries(GAME_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Toggle
            checked={doubleBoard}
            onChange={setDoubleBoard}
            label="Double Board"
            description="Deals two independent community boards simultaneously; pot splits 50/50 across Board A and Board B."
          />
        </div>

        {isTournament ? (
          <div className="rounded-xl border border-[#2a2f37] bg-[#1a1f26] p-5 space-y-2">
            <h2 className="text-base font-semibold text-slate-300">Side Games & Straddles</h2>
            <p className="text-xs text-slate-400">
              Side games (Bomb Pots, Kill Pots, 7-2 Bonus, Nit Game) and Straddles are not available in tournaments. To configure tournament bounties, use Tournament Structure Setup from the main table.
            </p>
          </div>
        ) : (
          <>
            {/* Bomb Pot */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-amber-300">Bomb Pot</h2>
                <input
                  type="checkbox"
                  checked={bombPot}
                  onChange={(e) => setBombPot(e.target.checked)}
                  className="w-4 h-4 accent-[#4a5a4a]"
                />
              </div>
              <p className="text-xs text-slate-400">
                Everyone antes a designated amount and the flop is dealt immediately with no preflop betting.
              </p>
              {bombPot && (
                <div className="pt-2">
                  <label className="text-xs text-slate-400 block mb-1">Bomb Pot Ante Per Player</label>
                  <input
                    type="number"
                    value={bombAmount}
                    onChange={(e) => setBombAmount(Number(e.target.value))}
                    className="w-36 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                  />
                </div>
              )}
            </div>

            {/* Kill Pot */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <h2 className="text-base font-semibold text-rose-300">Kill Pot / Half-Kill</h2>
              <p className="text-xs text-slate-400">
                When a player wins consecutive pots, the blinds are increased for the next hand and that player posts a forced live kill blind.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kill"
                    checked={killType === 'none'}
                    onChange={() => setKillType('none')}
                    className="accent-[#4a5a4a]"
                  />
                  Disabled
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kill"
                    checked={killType === 'full'}
                    onChange={() => setKillType('full')}
                    className="accent-[#4a5a4a]"
                  />
                  Full Kill (2x BB)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="kill"
                    checked={killType === 'half'}
                    onChange={() => setKillType('half')}
                    className="accent-[#4a5a4a]"
                  />
                  Half-Kill (1.5x BB)
                </label>
              </div>
            </div>

            {/* 7-2 Game */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-emerald-400">The 7-2 Game</h2>
                <input
                  type="checkbox"
                  checked={sevenTwo}
                  onChange={(e) => setSevenTwo(e.target.checked)}
                  className="w-4 h-4 accent-[#4a5a4a]"
                />
              </div>
              <p className="text-xs text-slate-400">
                If a player wins any hand holding 7-2 (at showdown or bluffing), every active table participant pays them a bonus penalty!
              </p>
              {sevenTwo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Standard 7-2 Bounty per Player</label>
                    <input
                      type="number"
                      value={sevenTwoAmount}
                      onChange={(e) => setSevenTwoAmount(e.target.value)}
                      placeholder="10 BB"
                      className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Suited 7-2 Bonus (Optional)</label>
                    <input
                      type="number"
                      value={sevenTwoSuited}
                      onChange={(e) => setSevenTwoSuited(e.target.value)}
                      placeholder="e.g. 15 BB"
                      className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Stand Up / Nit Game */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-amber-400">Stand Up (Nit Game)</h2>
                <input
                  type="checkbox"
                  checked={standUp}
                  onChange={(e) => setStandUp(e.target.checked)}
                  className="w-4 h-4 accent-[#4a5a4a]"
                />
              </div>
              <p className="text-xs text-slate-400">
                All players stand up. When a player wins a pot, they get to sit down. The last remaining player standing (the "Nit") pays a penalty to everyone else!
              </p>
              {standUp && (
                <div className="pt-2">
                  <label className="text-xs text-slate-400 block mb-1">Nit Penalty Amount (per player)</label>
                  <input
                    type="number"
                    value={standUpPenalty}
                    onChange={(e) => setStandUpPenalty(e.target.value)}
                    className="w-36 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                  />
                </div>
              )}
            </div>

            {/* Straddles */}
            <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-5 space-y-2">
              <h2 className="text-base font-semibold text-slate-200">Straddle Rules</h2>
              <Toggle
                checked={allowStraddle}
                onChange={setAllowStraddle}
                label="Allow UTG Straddle (2x BB)"
                description="First player to act before the flop can post a live straddle."
              />
              <Toggle
                checked={allowMultiStraddle}
                onChange={setAllowMultiStraddle}
                label="Allow Re-Straddle / Multi-Straddle"
                description="Subsequent players can double the straddle (4x BB, 8x BB...)."
              />
              <Toggle
                checked={mandatoryStraddle}
                onChange={setMandatoryStraddle}
                label="Mandatory Third Blind Straddle"
                description="Forced 3-blind game structure."
              />
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 pb-8">
          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white font-medium cursor-pointer"
          >
            Save & Return to Table
          </button>
        </div>
      </div>
    </div>
  );
}
