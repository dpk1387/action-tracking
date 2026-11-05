# Revised Implementation Plan: Font Fixes, Straddle Rules, Out Counts, and Multi-Board Dealing

This revised implementation plan addresses all user feedback:
1. **Typography**: Eliminating Consolas everywhere by redefining monospaced/numeric typography to Google Font **Inter** with tabular numbers (`tabular-nums`).
2. **Straddle**: Removing straddle amount customization and locking it to $2\times$ the biggest blind in play ($2\times \text{BB}$, or $2\times \text{3rd/4th Blind}$).
3. **Split % Display**: Only rendering split percentage if a split is genuinely possible ($>0\%$). If exactly $0\%$, hide the badge; if $>0\%$ and $<1\%$, show `<1%`.
4. **ReferenceError Fix**: Fix `splitPct is not defined` in `PokerTracker.jsx`.
5. **Outs Display**: Show all outs for each player without truncating at 5 or appending `+X`.
6. **Run It 2x / 3x in Cash Games**:
   - Always offer the Run It 2x/3x option in cash games when 2+ players are all-in with no pending betting action.
   - When running multiple times, deal board-by-board (Board 1 run to completion first, then Board 2, then Board 3) instead of street-by-street.

---

## 1. Technical Details & Proposed Changes

### A. Font Architecture & Consolas Elimination
- **Root Cause**: Tailwind CSS `.font-mono` falls back to `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`. On Windows without SFMono, it resolves to **Consolas**.
- **Fix**:
  1. In `src/index.css`:
     - Redefine `--font-mono` to `'Inter', system-ui, sans-serif`.
     - Add `.font-mono, [class*="font-mono"] { font-family: 'Inter', system-ui, sans-serif !important; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }`.
     - Apply `font-family: 'Inter', system-ui, sans-serif` globally to `*`, `body`, and inputs.
  2. In `TournamentClockView.jsx`: Replace `font-mono` with `tabular-nums` on field remaining, chips, average stack, blinds, next level, and prize payouts.
  3. In `StacksBar.jsx`: Replace `font-mono` with `tabular-nums` on stack rows.
  4. In `AllInView.jsx`: Replace `font-mono` with `tabular-nums` on player stack sizes, equity, pot size, and remove `font-mono` from action text.
  5. In `TVView.jsx` and `Spectator.jsx`: Replace `font-mono` with `tabular-nums`.

### B. Straddle Simplification
- In `SetupDialog.jsx`: Remove the `Straddle amount` text input. Keep the toggles "Allow straddle (UTG)" and "Allow re-straddle".
- In `src/lib/poker.js`:
  - Calculate straddle amount automatically:
    - 4 blinds: $2\times$ the fourth blind.
    - 3 blinds: $2\times$ the third blind.
    - Standard 2 blinds: $2\times$ the big blind.
  - Re-straddles double the preceding straddle amount.

### C. Split Percentage Display
- In `AllInView.jsx`:
  - Only show split badge when `computedEquity?.split > 0`.
  - Format `<1%` if between $0\%$ and $1\%$; show exact rounded percentage if $\ge 1\%$. If $0\%$, suppress the element entirely.

### D. Fix `splitPct is not defined`
- In `PokerTracker.jsx` line 870:
  - Add `let splitPct = 0;` inside the equity calculation callback before the `isTriple` condition.

### E. Display All Outs
- In `AllInView.jsx`:
  - Remove `.slice(0, 5)` and the `+X` badge.
  - Render all outs horizontally with smooth scrolling / wrapping so every single out is visible.

### F. Cash Game "Run It Multiple Times" & Board-by-Board Dealing
- **Trigger**: In cash games (`hand.mode === 'cash' || !hand.mode`), when $2+$ active players are all-in and betting is frozen (`bettingFrozen(hand)` or all-in showdown with `currentPlayer === -1`), and the board is not yet complete:
  - Always render "Run It 2x" and "Run It 3x" buttons.
- **Dealing Sequence**:
  - Instead of dealing street-by-street across all boards, prompt to deal **Board 1** to completion (e.g. remaining turn & river, or remaining flop, turn & river), then deal **Board 2** to completion, and **Board 3** (if 3x).
  - Update `CommunityCardInput.jsx` and dealing logic to support completing Board 1 first, then Board 2, then Board 3.

---

## 2. Verification Plan & Results
- [x] `npm run lint` (`tsc --noEmit`): Passed with 0 errors.
- [x] `npm run build` (`vite build`): Applet compiled cleanly and successfully.
- [x] Verified typography: Monospace fonts redirected to Inter with `tabular-nums`; Consolas eliminated across Tournament Director, Action Tracker stacks & pot, Player tags, and broadcast displays.
- [x] Verified cash game all-in: "Run It 2x" and "Run It 3x" options reliably offered when 2+ players are all-in and betting is complete; board-by-board deal flow implemented.
- [x] Verified outs display: All outs are rendered with full scrollable badge and no 5-card cap or `+X`.
- [x] Verified split %: Badge is completely hidden when 0% and displays `<1%` when $>0\%$ and $<1\%$.
- [x] Verified straddle: Custom amount input removed; straddles automatically calculate at $2\times$ the highest blind in play with doubling on re-straddles.
