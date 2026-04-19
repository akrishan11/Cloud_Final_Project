import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import { NavBar } from '../components/NavBar';

interface Position {
  marketId: string;
  marketTitle: string | null;
  marketStatus: string | null;
  side: 'YES' | 'NO';
  shares: number;
  costBasis: number;
  currentPrice: number | null;
  unrealizedPnl: number | null;
  createdAt: string;
}

interface SettledPosition {
  marketId: string;
  marketTitle: string | null;
  side: 'YES' | 'NO';
  shares: number;
  costBasis: number;
  payout: number;
  realizedPnl: number;
  outcome: 'YES' | 'NO' | null;
  settledAt: string | null;
}

export function PortfolioPage() {
  const navigate = useNavigate();
  const { balance, idToken, signOut } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [settled, setSettled] = useState<SettledPosition[]>([]);
  const [settledLoading, setSettledLoading] = useState(true);
  const [settledError, setSettledError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchPositions() {
      try {
        const res = await apiFetch('/me/positions', idToken);
        if (!res.ok) throw new Error('non-ok response');
        const data = (await res.json()) as { positions: Position[] };
        if (!cancelled) setPositions(data.positions ?? []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPositions();
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  useEffect(() => {
    let cancelled = false;
    async function fetchSettled() {
      try {
        const res = await apiFetch('/me/positions?type=settled', idToken);
        if (!res.ok) throw new Error('non-ok response');
        const data = (await res.json()) as { positions: SettledPosition[] };
        if (!cancelled) setSettled(data.positions ?? []);
      } catch {
        if (!cancelled) setSettledError(true);
      } finally {
        if (!cancelled) setSettledLoading(false);
      }
    }
    fetchSettled();
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  function pnlColor(v: number | null): string {
    if (v == null || v === 0) return 'text-gray-500 dark:text-[#8A8A90]';
    return v > 0 ? 'text-classhi-green' : 'text-classhi-coral';
  }
  function pnlText(v: number | null): string {
    if (v == null) return '—';
    if (v === 0) return '$0.00';
    const sign = v > 0 ? '+' : '-';
    return `${sign}$${Math.abs(v).toFixed(2)}`;
  }

  return (
    <div className="min-h-screen bg-classhi-bg dark:bg-dark-bg">
      <NavBar onSignOut={handleSignOut} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-condensed font-bold tracking-tight text-[#111111] dark:text-white">Portfolio</h1>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-dark-border dark:bg-dark-card">
          <p className="text-sm text-gray-500 dark:text-[#8A8A90]">Current Balance</p>
          <p className="mt-1 text-3xl font-ticker font-bold text-[#111111] dark:text-white">
            ${balance != null ? balance.toLocaleString() : '—'}
          </p>
        </section>

        <h2 className="mt-8 text-xl font-condensed font-semibold text-[#111111] dark:text-white">Open Positions</h2>

        {loading && (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-[#8A8A90]">Loading portfolio...</p>
        )}

        {!loading && error && (
          <p className="mt-4 text-center text-sm text-classhi-coral">
            Failed to load portfolio. Please try again.
          </p>
        )}

        {!loading && !error && positions.length === 0 && (
          <div className="mt-4 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-[#8A8A90]">No open positions yet.</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#8A8A90]">
              Place a bet on a market to get started.
            </p>
          </div>
        )}

        {!loading && !error && positions.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {positions.map((p) => (
              <div
                key={p.marketId}
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-dark-border dark:bg-dark-card"
              >
                <div className="flex items-start justify-between">
                  <span className="flex-1 text-sm font-semibold text-[#111111] dark:text-white">
                    {p.marketTitle ?? p.marketId}
                  </span>
                  <span
                    className={`ml-2 rounded-full px-3 py-0.5 text-xs font-bold text-white ${
                      p.side === 'YES' ? 'bg-classhi-green' : 'bg-classhi-coral'
                    }`}
                  >
                    {p.side}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-[#8A8A90]">
                  <span>Shares: {p.shares.toFixed(2)}</span>
                  <span>
                    Current price: {p.currentPrice != null ? `${p.currentPrice}¢` : '—'}
                  </span>
                  <span className={pnlColor(p.unrealizedPnl)}>
                    Unrealized P&L: {pnlText(p.unrealizedPnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mt-8 text-xl font-condensed font-semibold text-[#111111] dark:text-white">Settled Positions</h2>

        {settledLoading && (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-[#8A8A90]">Loading settled positions...</p>
        )}

        {!settledLoading && settledError && (
          <p className="mt-4 text-center text-sm text-classhi-coral">
            Failed to load settled positions. Please try again.
          </p>
        )}

        {!settledLoading && !settledError && settled.length === 0 && (
          <div className="mt-4 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-[#8A8A90]">No settled positions yet.</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#8A8A90]">
              Positions appear here after a market is resolved.
            </p>
          </div>
        )}

        {!settledLoading && !settledError && settled.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {settled.map((p) => {
              const won = p.outcome != null && p.side === p.outcome;
              return (
                <div
                  key={p.marketId}
                  className="rounded-lg border border-gray-200 bg-white p-4 dark:border-dark-border dark:bg-dark-card"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex-1 text-sm font-semibold text-[#111111] dark:text-white">
                      {p.marketTitle ?? p.marketId}
                    </span>
                    <span
                      className={`ml-2 rounded-full px-3 py-0.5 text-xs font-bold text-white ${
                        p.side === 'YES' ? 'bg-classhi-green' : 'bg-classhi-coral'
                      }`}
                    >
                      {p.side}
                    </span>
                    <span
                      className={`ml-2 rounded-full px-3 py-0.5 text-xs font-bold ${
                        won
                          ? 'bg-classhi-green text-white'
                          : 'bg-gray-200 text-gray-700 dark:bg-[#28282C] dark:text-gray-300'
                      }`}
                    >
                      {won ? 'WON' : 'LOST'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-[#8A8A90]">
                    <span>Shares: {p.shares.toFixed(2)}</span>
                    <span>Payout: ${p.payout.toFixed(2)}</span>
                    <span className={p.realizedPnl > 0 ? 'text-classhi-green' : 'text-gray-500 dark:text-[#8A8A90]'}>
                      Realized P&L: {p.realizedPnl > 0 ? `+$${p.realizedPnl.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
