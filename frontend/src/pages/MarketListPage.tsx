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

export function MarketListPage() {
  const navigate = useNavigate();
  const { isAdmin, idToken, signOut } = useAuth();
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
        if (!cancelled) {
          setMarkets(data.markets ?? []);
        }
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

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-condensed font-bold tracking-tight text-[#111111] dark:text-white">Markets</h1>
        </div>

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
          <div className="flex flex-col gap-4">
            {visibleMarkets.map((market) => (
              <div
                key={market.marketId}
                onClick={() => navigate('/markets/' + market.marketId)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 transition-all hover:border-l-2 hover:border-classhi-green dark:border-dark-border dark:bg-dark-card dark:hover:border-classhi-green"
              >
                <div className="flex items-start justify-between">
                  <span className="text-base font-semibold text-[#111111] dark:text-white">
                    {market.title}
                  </span>
                  {market.status === 'open' || market.status === 'scheduled' ? (
                    <span className="ml-4 shrink-0 text-sm text-gray-500 dark:text-[#8A8A90]">
                      {formatTimeLeft(market.closeAt)}
                    </span>
                  ) : (
                    <span className="ml-4 shrink-0 rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold uppercase text-gray-700 dark:bg-[#28282C] dark:text-gray-300">
                      {market.status}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full border border-classhi-green px-3 py-0.5 text-xs font-ticker font-semibold text-classhi-green">
                    Yes {market.yesPrice}¢
                  </span>
                  <span className="rounded-full border border-classhi-coral px-3 py-0.5 text-xs font-ticker font-semibold text-classhi-coral">
                    No {market.noPrice}¢
                  </span>
                  <span className="ml-auto text-xs text-gray-500 dark:text-[#8A8A90]">
                    Vol: ${market.volume.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
