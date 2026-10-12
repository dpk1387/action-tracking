// Base44 client emulator for persistent local/cross-tab storage and auth

function getStoredSessions() {
  try {
    const raw = localStorage.getItem('poker_saved_sessions_store');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredSessions(store) {
  try {
    localStorage.setItem('poker_saved_sessions_store', JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save session store', e);
  }
}

export const db = {
  auth: {
    isAuthenticated: async () => {
      return !!localStorage.getItem('poker_auth_user');
    },
    me: async () => {
      const u = localStorage.getItem('poker_auth_user');
      if (!u) return null;
      try {
        return JSON.parse(u);
      } catch {
        return null;
      }
    },
    redirectToLogin: (url) => {
      const target = url || window.location.href;
      window.location.href = `/login?returnTo=${encodeURIComponent(target)}`;
    },
    loginViaEmailPassword: async (email, password) => {
      if (!email || !password) throw new Error('Email and password are required');
      const user = {
        id: 'usr_' + Math.abs(email.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)),
        email,
        full_name: email.split('@')[0],
        role: 'user',
      };
      localStorage.setItem('poker_auth_user', JSON.stringify(user));
      localStorage.setItem('base44_access_token', 'token_' + Date.now());
      return user;
    },
    loginWithProvider: (provider, returnTo) => {
      const user = {
        id: 'usr_google_' + Date.now().toString(36),
        email: 'player@example.com',
        full_name: 'Poker Player',
        role: 'user',
      };
      localStorage.setItem('poker_auth_user', JSON.stringify(user));
      localStorage.setItem('base44_access_token', 'token_' + Date.now());
      window.location.href = returnTo || '/';
    },
    resetPasswordRequest: async (_email) => true,
    resetPassword: async (_token, _password) => true,
    logout: (redirectUrl) => {
      localStorage.removeItem('poker_auth_user');
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },
  },
  app: {
    getPublicSettings: async () => {
      return { id: 'poker-action-tracker', public_settings: {} };
    },
  },
  entities: new Proxy(
    {},
    {
      get: () => ({
        filter: async () => ({ items: [] }),
        get: async () => null,
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => ({}),
      }),
    }
  ),
  functions: {
    invoke: async (name, args = {}) => {
      const store = getStoredSessions();
      let user = null;
      try {
        const u = localStorage.getItem('poker_auth_user');
        if (u) user = JSON.parse(u);
      } catch {}

      if (name === 'listSavedSessions') {
        const list = Object.values(store)
          .filter((item) => !item.hostId || (user && item.hostId === user.id))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .map((r) => {
            const rs = r.resumeState || {};
            const h = rs.hand || {};
            const players = (h.players || []).map((p) => p.name).filter(Boolean);
            return {
              shareCode: r.shareCode,
              updatedAt: r.updatedAt,
              mode: h.mode || rs.config?.mode,
              variant: h.variant || rs.config?.variant || 'nlh',
              handNumber: h.handNumber,
              smallBlind: h.smallBlind,
              bigBlind: h.bigBlind,
              currency: h.currency || rs.config?.currency,
              playerNames: players,
            };
          });
        return { data: { sessions: list } };
      }

      if (name === 'readSavedSession') {
        const { shareCode } = args;
        const record = store[shareCode];
        if (!record || !record.resumeState || !record.resumeState.hand) {
          return { data: { error: 'No saved session' } };
        }
        return { data: { resumeState: record.resumeState, updatedAt: record.updatedAt } };
      }

      if (name === 'readLiveSession') {
        const code = args.shareCode || args.code;
        const record = store[code];
        if (!record) return { data: { error: 'No session yet' } };
        return { data: { state: record.state || null, updatedAt: record.updatedAt } };
      }

      if (name === 'publishLiveSession') {
        const { shareCode, hand, config, gameOver, equity, hideAmounts, holeCards } = args;
        if (!shareCode) return { data: { error: 'No share code' } };
        const updatedAt = new Date().toISOString();
        const resumeState = {
          config: config || null,
          hand: hand || null,
          gameOver: gameOver || null,
          holeCards: holeCards || null,
        };
        const state = {
          hand,
          config,
          gameOver,
          equity,
          hideAmounts,
          _holeCards: holeCards,
        };
        store[shareCode] = {
          shareCode,
          hostId: user ? user.id : null,
          state,
          resumeState,
          updatedAt,
        };
        saveStoredSessions(store);
        return { data: { ok: true, shareCode, updatedAt } };
      }

      if (name === 'discardSavedSession') {
        const { shareCode } = args;
        if (store[shareCode]) {
          delete store[shareCode];
          saveStoredSessions(store);
        }
        return { data: { ok: true, deleted: true } };
      }

      if (name === 'exportSessionToSheets') {
        const hands = args.hands || [];
        // Generate CSV file content
        const rows = [['Hand #', 'Blinds', 'Board', 'Pot', 'Winners', 'Summary']];
        hands.forEach((h) => {
          const boardStr = (h.communityCards || []).map((c) => (c.hidden ? '?' : c.rank + c.suit)).join(' ');
          const winnersStr = (h.winners || []).map((w) => {
            const p = (h.players || []).find((pl) => pl.id === w.playerId);
            return `${p ? p.name : 'Unknown'}: ${w.amount}`;
          }).join(', ');
          const pot = (h.pots || []).reduce((s, p) => s + (p.amount || 0), 0);
          rows.push([
            h.handNumber,
            `${h.smallBlind}/${h.bigBlind}`,
            boardStr,
            pot,
            winnersStr,
            (h.notes || []).join(' | '),
          ]);
        });
        const csvContent = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        return { data: { url, success: true } };
      }

      return { data: {} };
    },
  },
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' }),
    },
  },
};

export const base44 = db;
export default db;
