import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import { NavBar } from '../components/NavBar';

interface Market {
  marketId: string;
  title: string;
  description: string;
  status: 'scheduled' | 'open' | 'closed' | 'resolved';
  yesPrice: number;
  noPrice: number;
  volume: number;
  openAt: string;
  closeAt: string;
  createdAt: string;
  createdBy: string;
}

function formatTimeLeft(closeAt: string): string {
  const diff = new Date(closeAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function MarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const isActive = market.status === 'open' || market.status === 'scheduled';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 flex flex-col gap-4 hover:border-classhi-green transition-colors dark:border-dark-border dark:bg-dark-card dark:hover:border-classhi-green"
    >
      {/* Title */}
      <p className="text-[15px] font-semibold leading-snug text-[#111111] dark:text-white">
        {market.title}
      </p>

      {/* Outcomes */}
      <div className="flex flex-col gap-2">
        {/* YES row */}
        <div className="flex items-center gap-3">
          <span className="w-7 shrink-0 text-sm font-medium text-[#111111] dark:text-white">YES</span>
          <div className="flex-1 h-[3px] rounded-full bg-gray-200 dark:bg-[#28282C]">
            <div className="h-full rounded-full bg-classhi-green" style={{ width: `${market.yesPrice}%` }} />
          </div>
          <span className="shrink-0 rounded-full border border-classhi-green px-3 py-1 text-sm font-semibold text-classhi-green">
            {market.yesPrice}%
          </span>
        </div>

        {/* NO row */}
        <div className="flex items-center gap-3">
          <span className="w-7 shrink-0 text-sm font-medium text-[#111111] dark:text-white">NO</span>
          <div className="flex-1 h-[3px] rounded-full bg-gray-200 dark:bg-[#28282C]">
            <div className="h-full rounded-full bg-classhi-coral" style={{ width: `${market.noPrice}%` }} />
          </div>
          <span className="shrink-0 rounded-full border border-classhi-coral px-3 py-1 text-sm font-semibold text-classhi-coral">
            {market.noPrice}%
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-dark-border">
        <span className="text-xs text-gray-500 dark:text-[#8A8A90]">
          ${(market.volume ?? 0).toLocaleString()} vol
        </span>
        {isActive ? (
          <span className="text-xs text-gray-500 dark:text-[#8A8A90]">
            {formatTimeLeft(market.closeAt)}
          </span>
        ) : (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-500 dark:bg-[#28282C] dark:text-gray-400">
            {market.status}
          </span>
        )}
      </div>
    </div>
  );
}

export function MarketListPage() {
  const navigate = useNavigate();
  const { idToken, signOut } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchMarkets() {
      try {
        const res = await apiFetch('/markets', idToken);
        if (!res.ok) throw new Error('non-ok response');
        const data = await res.json() as { markets: Market[] };
        if (!cancelled) setMarkets(data.markets ?? []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMarkets();
    return () => { cancelled = true; };
  }, [idToken]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const statusOrder = (s: string) => (s === 'open' || s === 'scheduled' ? 0 : 1);
  const visibleMarkets = [...markets].sort(
    (a, b) => statusOrder(a.status) - statusOrder(b.status),
  );

  return (
    <div className="min-h-screen bg-classhi-bg dark:bg-dark-bg">
      <NavBar onSignOut={handleSignOut} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-condensed font-bold tracking-tight text-[#111111] dark:text-white">
          Markets
        </h1>

        {loading && (
          <p className="text-center text-gray-500 dark:text-[#8A8A90]">Loading markets...</p>
        )}

        {!loading && error && (
          <p className="text-center text-classhi-coral">Failed to load markets.</p>
        )}

        {!loading && !error && visibleMarkets.length === 0 && (
          <p className="text-center text-gray-500 dark:text-[#8A8A90]">No open markets yet.</p>
        )}

        {!loading && !error && visibleMarkets.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleMarkets.map((market) => (
              <MarketCard
                key={market.marketId}
                market={market}
                onClick={() => navigate('/markets/' + market.marketId)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
