# Tournament Director Mode & Broadcast Clock System

Comprehensive implementation plan to add dedicated Tournament Director Mode (pure tournament orchestration without hand-action tracking), high-visibility broadcast Clock View across Director, TV, and Spectator displays, flexible tournament payout configuration engine, and unified director control menu.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were aligned during Phase 1:
> - **Director Mode Access**: Prompt at tournament startup to pick either **Tournament Director Mode** or **Action Tracker Mode**, with an ongoing navigation switch in the top header.
> - **Control Menu Placement**: Docked directly below the broadcast Clock View on the Director interface with collapsible expand/collapse capability, while remaining completely hidden on TV and Spectator views.
> - **Simultaneous Bust Ranking**: Interactive drag-and-drop / rank-ordering list modal when busting multiple players simultaneously if stack-based tie-breaking is enabled.

---

## 1. Overview & Core Concept

- **What It Does**: Enables tournament directors and home game hosts to run poker tournaments effortlessly without logging individual player seat actions or chip bets. It features a complete broadcast-grade tournament clock, customizable multi-tier payout math with simultaneous elimination handling, field sizing recommendations, level pre-planning, and synchronized TV/Spectator views.
- **Target Audience / Persona**: Tournament directors, poker club operators, and home game hosts running single or multi-table MTTs/SNGs.
- **Key Value**: Eliminates the burden of tracking action history while providing an immaculate, readable tournament clock display that looks stunning on big-screen TVs and mobile spectator screens.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Tournament Startup & Mode Choice**:
   - Starting a tournament prompts the host:
     - **Tournament Director Mode** (Direct clock, levels, field count, rebuys, and payouts)
     - **Action Tracker Mode** (Track live hands, pots, and street actions)
2. **Simplified Director Structure Setup**:
   - Streamlined dialog omitting individual seat assignments, stack sizes per player, and action tracking.
   - Host configures:
     - Number of starting players & starting stack size.
     - Number of tables (with dynamic recommendation banner based on table density, e.g., alerting if tables have $<5$ or $>10$ players).
     - Blind schedule & level durations (minutes) with break intervals.
     - Late registration and rebuy/re-entry rules.
     - Payout structure configuration (custom ranks by number, range, or percentage bracket; payouts by fixed cash or prize pool percentage; simultaneous elimination tie-breaking toggle).
3. **Director Workspace (Clock View + Control Dock)**:
   - Top-level Clock View taking center stage.
   - Bottom Control Dock providing one-tap tournament controls:
     - Level jump (`Set Level`, `Next Level`).
     - Clock controls (`Pause/Play`, `+1 Min`, `-1 Min`).
     - `Hand for Hand` toggle button with active warning badge.
     - `Record Bust` (single or multi-player bust dialog with stack-ranking reorder).
     - Manual Player Count `+` / `-` quick-steppers.
     - `Pre-Plan Level` modal to inject or preview the next blind tier.
     - `Rebuy / Re-entry` counter button.
4. **Broadcast TV & Spectator Displays (`/tv` & `/spectator`)**:
   - Displays the dedicated full-screen Clock View without control buttons.
   - Synchronized in real time via BroadcastChannel / localStorage / cloud sync.

### Visual Identity & Theme

- **Aesthetic Direction**: High-contrast casino stadium digital display. Clean dark theme (`#0c0f14` background), tabular monospace numerals, crisp emerald and amber accents, zero visual clutter.
- **Clock View Layout (3-Column Stadium Grid)**:
  - **Middle**: Current Level number banner, giant high-contrast tabular countdown (`MM:SS`), Next Break alert countdown.
  - **Left Column**: Field Remaining with giant bold numerator and subtle denominator (e.g. **18** / 27 Players), Total Chips in play (`# players * starting stack + rebuys`), Average Stack.
  - **Right Column**: Current Level & Blinds (SB / BB / Ante), Prize Structure Ladder (paying positions, percentages, and dollar amounts), Next Level Blinds.
- **Hand for Hand Mode**: Visible amber warning banner and pulsing clock indicator across all views when bubble play is active.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Flexible Payout Engine Architecture**:
  - *Chosen Approach*: Write a standalone pure functional payout calculation utility (`calculateTournamentPayouts`) handling:
    1. Rank definitions: Specific number (`1`), range (`3-5`), or percentage bracket (`top 2%` / `next 2% of field`).
    2. Payout definitions: Fixed currency amount or percentage of total pool.
    3. Dual percentage resolution: If both rank and payout are percentages, distribute the pooled bracket slice evenly among the players in that bracket.
    4. Simultaneous elimination handling: Boolean toggle `splitSimultaneousTies`. When `true`, tied players share pooled bracket money; when `false`, prompt host to order finishes based on entering chip stacks.
    5. Default table-based payout rules: 1 table = Top 3 (50%/30%/20%), 2 tables = Top 4 (45%/25%/18%/12%), 3+ tables = Top 5 (40%/25%/17%/11%/7%).
  - *Why*: Robust, predictable math that handles any custom tournament rules without edge-case rounding discrepancies.
- **Decision 2: Unified Clock View for Director, TV, and Spectator**:
  - *Chosen Approach*: Create a reusable `<TournamentClockView />` component that accepts a `readOnly` prop. In Director Mode, it is embedded above the Control Menu. In `/tv` and `/spectator`, it renders full-screen with responsive typography.
  - *Why*: Eliminates code duplication, guarantees identical visual fidelity between host station and TV monitors, and ensures real-time parity.
- **Decision 3: Quick Manual +/- vs. Named Player Busts**:
  - *Chosen Approach*: Offer both: quick `+` / `-` buttons on the control dock for rapid field reduction before the money bubble, and a `Record Bust` modal that supports named players or stack-ordered finishes when entering the money.

---

## 4. Technical Architecture & Data Strategy

### System & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          App Routing & State                           │
│     (sessionStore / mttStore / liveSync BroadcastChannel & Cloud)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  / (Director /   │       │   /tv (Broadcast │       │    /spectator    │
│    Tracker View) │       │      Display)    │       │     (Mobile)     │
└────────┬─────────┘       └────────┬─────────┘       └────────┬─────────┘
         │                          │                          │
         │                          └────────────┬─────────────┘
         │                                       │
         ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TournamentClockView                             │
│   ┌────────────────────┬────────────────────┬──────────────────────┐   │
│   │    LEFT COLUMN     │   MIDDLE COLUMN    │     RIGHT COLUMN     │   │
│   │ · Field Remaining  │ · Level Number     │ · Current Blinds     │   │
│   │   (Bold Fraction)  │ · Time Remaining   │ · Next Level Blinds  │   │
│   │ · Total Chips      │ · Next Break Time  │ · Prize Pool Ladder  │   │
│   │ · Average Stack    │ · Hand-for-Hand    │ · ITM Bubble Marker  │   │
│   └────────────────────┴────────────────────┴──────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         (Director Mode Only)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Director Control Menu Dock                        │
│ ┌───────────────┬─────────────────┬─────────────────┬────────────────┐ │
│ │ Clock Stepper │ Level Jump      │ Field Controls  │ Tournament Ops │ │
│ │ · Pause/Play  │ · Next Level    │ · Record Bust   │ · Pre-Plan Lvl │ │
│ │ · -1m / +1m   │ · Set Level     │ · Field +/-     │ · Rebuy/Addon  │ │
│ │               │ · Hand-for-Hand │                 │ · Structure    │ │
│ └───────────────┴─────────────────┴─────────────────┴────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Implementation Steps

1. **Bug Fixes & Code Cleanup**:
   - Fix unrouted `MTTDirector` in `App.tsx` and ensure state consistency between `sessionStore` and `mttStore`.
   - Clean up scope ordering in `SetupDialog.jsx` and missing references.
2. **Payout Logic Engine (`src/lib/payoutEngine.js`)**:
   - Implement `calculateTournamentPayouts({ totalPlayers, buyIn, totalPool, payoutConfig, splitSimultaneousTies, simultaneousEliminations })`.
   - Handle rank types (single place, range `X-Y`, percentage bracket `next X%`).
   - Implement default table templates (1 table: 50/30/20; 2 tables: 45/25/18/12; 3+ tables: 40/25/17/11/7).
3. **Director Structure Setup Modal (`src/components/poker/DirectorSetupDialog.jsx`)**:
   - Clean setup form: Table count with live player density recommendations (too short-handed vs. overcrowded notice).
   - Starting stack, buy-in, blind level duration, late reg toggle, and customizable payout structure editor.
4. **Tournament Clock View Component (`src/components/poker/TournamentClockView.jsx`)**:
   - Standardized 3-column view:
     - Middle: Level number, tabular time countdown, next break timer.
     - Left: Remaining field fraction (`rem / total`), total chips, average stack.
     - Right: Blinds display, prize pool ladder, next level sneak-peek.
5. **Director Control Dock & Dialogs (`src/components/poker/DirectorControlDock.jsx`)**:
   - Floating/docked bottom control bar with hand-for-hand toggle, level skip, timer adjustments, pre-plan level dialog, and multi-player bust recording modal with finishing rank reordering.
6. **TV & Spectator Display Integration**:
   - Wire `/tv` and `/spectator` to detect director mode and automatically render the full-screen `<TournamentClockView />`.
