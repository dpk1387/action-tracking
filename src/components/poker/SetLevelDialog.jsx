import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { formatKM } from '@/lib/poker';

export default function SetLevelDialog({ hand, onApply, onClose }) {
  const schedule = hand?.blindSchedule || [];
  const segments = [];
  let levelCount = 0;
  schedule.forEach((item, i) => {
    if (item.type === 'break') {
      const isCol = Boolean(item.isColorUp || (item.race && (item.race.retired || item.race.replacement)));
      segments.push({
        idx: i,
        kind: isCol ? 'color_up' : 'break',
        label: isCol ? `Color Up after level ${levelCount}` : `Break after level ${levelCount}`,
        minutes: item.minutes || (isCol ? 2 : 10),
        race: item.race,
      });
    } else if (item.type === 'color_up') {
      segments.push({
        idx: i,
        kind: 'color_up',
        label: `Color Up after level ${levelCount}`,
        minutes: item.minutes || 2,
        race: item.race,
      });
    } else {
      levelCount++;
      segments.push({
        idx: i,
        kind: 'level',
        label: `Level ${levelCount}`,
        smallBlind: item.smallBlind,
        bigBlind: item.bigBlind,
        minutes: item.minutes,
      });
    }
  });

  const currentTLevel = hand?.tLevel || 0;
  const currentSeg = segments.find((s) => s.idx === currentTLevel) || segments[0];
  const [segIdx, setSegIdx] = useState(currentSeg ? String(currentSeg.idx) : '0');
  const cfg = hand?.levelConfig || { method: 'minutes', value: 20 };
  const isMinutes = cfg.method === 'minutes';
  const [minutesRemaining, setMinutesRemaining] = useState('');
  const selected = segments.find((s) => String(s.idx) === segIdx);
  const fullMinutes = selected
    ? (selected.kind === 'break' || selected.kind === 'color_up')
      ? Number(selected.minutes) || (selected.kind === 'color_up' ? 2 : 10)
      : (Number(selected.minutes) > 0 ? Number(selected.minutes) : Number(cfg.value) || 20)
    : 20;

  const missedRaces = useMemo(() => {
    if (!selected) return [];
    const from = currentTLevel;
    const to = selected.idx;
    if (to <= from) return [];
    const out = [];
    for (let i = from + 1; i < to; i++) {
      const item = schedule[i];
      if ((item?.type === 'break' || item?.type === 'color_up') && item.race && Number(item.race.retired) > 0 && Number(item.race.replacement) > 0) {
        out.push({ tLevel: i, retired: Number(item.race.retired), replacement: Number(item.race.replacement) });
      }
    }
    return out;
  }, [selected, currentTLevel, schedule]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Set level & time</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
        </div>
        <div className="text-xs text-slate-500 mb-2">Jump the tournament to any level, break, or color up in the schedule.</div>
        <label className="text-xs text-slate-400 block mb-1">Level / break / color up</label>
        <select
          value={segIdx}
          onChange={(e) => setSegIdx(e.target.value)}
          className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm mb-4"
        >
          {segments.map((s) => (
            <option key={s.idx} value={String(s.idx)}>
              {s.label}
              {s.kind === 'level'
                ? ` — ${formatKM(s.smallBlind)}/${formatKM(s.bigBlind)}`
                : s.kind === 'color_up'
                ? ` — Color Up (${s.minutes} min${s.race ? ` ${formatKM(s.race.retired)}→${formatKM(s.race.replacement)}` : ''})`
                : ` — ${s.minutes} min`}
            </option>
          ))}
        </select>
        {isMinutes && (
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">
              Time remaining (minutes) – blank starts from full
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={minutesRemaining}
              onChange={(e) => setMinutesRemaining(e.target.value)}
              placeholder={`full (${fullMinutes} min)`}
              className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              The timer jumps to this level immediately. Blinds update now if no action has happened this hand, otherwise at the next hand.
            </div>
          </div>
        )}
        {selected && (
          <div className="rounded-lg bg-[#15181d] border border-[#2a2f37] p-3 mb-4 text-sm text-slate-300">
            {selected.kind === 'break' ? (
              <div>This will start a {selected.minutes}-minute break.</div>
            ) : selected.kind === 'color_up' ? (
              <div>
                <div>This will start a {selected.minutes}-minute Color Up break.</div>
                {selected.race && (
                  <div className="text-xs text-amber-300/80 mt-1">
                    Chip race: {formatKM(selected.race.retired)} chips colored up to {formatKM(selected.race.replacement)}.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div>Blinds: {formatKM(selected.smallBlind)} / {formatKM(selected.bigBlind)}</div>
                {!isMinutes && <div className="text-xs text-slate-500 mt-1">Timer method is {cfg.method} – level counter resets.</div>}
              </div>
            )}
          </div>
        )}
        {missedRaces.length > 0 && (
          <div className="rounded-xl border border-[#6b5a2a] bg-[#2a2418] p-3 mb-4">
            <div className="text-xs text-amber-300 uppercase tracking-wide mb-1">
              Missed chip race{missedRaces.length > 1 ? 's' : ''}
            </div>
            <div className="text-[11px] text-amber-300/80">
              {missedRaces.length} race{missedRaces.length > 1 ? 's' : ''} skipped by this jump ({missedRaces.map((r) => `${formatKM(r.retired)}→${formatKM(r.replacement)}`).join(', ')}).
              The timer will pause and the chip race will be offered after the current hand finishes.
            </div>
          </div>
        )}
        <button
          onClick={() => {
            if (!selected) return;
            const tLevel = selected.idx;
            let levelStartEpoch;
            if (isMinutes) {
              const mr = Number(minutesRemaining);
              if (minutesRemaining && mr >= 0) {
                const dur = fullMinutes * 60000;
                levelStartEpoch = Date.now() - (dur - mr * 60000);
              } else {
                levelStartEpoch = Date.now();
              }
            } else {
              levelStartEpoch = Date.now();
            }
            let nextPlayable = selected.kind === 'level' ? tLevel : tLevel + 1;
            while (nextPlayable < schedule.length && (schedule[nextPlayable]?.type === 'break' || schedule[nextPlayable]?.type === 'color_up')) {
              nextPlayable++;
            }
            onApply({
              tLevel,
              inBreak: selected.kind === 'break' || selected.kind === 'color_up',
              isColorUp: selected.kind === 'color_up',
              levelStartEpoch,
              levelHandsCompleted: 0,
              pendingLevelIdx: nextPlayable,
              missedRaces,
              pendingRace: selected.kind === 'color_up' && selected.race ? { ...selected.race, tLevel } : undefined,
            });
            onClose();
          }}
          disabled={!selected}
          className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-40 mt-2 cursor-pointer"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
