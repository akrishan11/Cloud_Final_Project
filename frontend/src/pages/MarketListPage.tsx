import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

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
  const { email, balance, isAdmin, idToken, signOut } = useAuth();
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

  const openMarkets = markets.filter((m) => m.status === 'open');

  return (
    <div className="min-h-screen bg-classhi-bg">
      {/* Nav bar */}
      <nav className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span className="text-lg font-semibold text-[#111111]">Classhi</span>
          <div className="flex items-center gap-4">
            {email && (
              <span className="text-sm text-gray-500">
                {email}
                {balance !== null && (
                  <span className="ml-2 font-semibold text-[#111111]">
                    — ${balance.toLocaleString()}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate('/portfolio')}
              className="text-sm font-semibold text-[#111111] hover:underline"
            >
              Portfolio
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm font-semibold text-classhi-coral hover:underline"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-[#111111]">Markets</h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin/create-market')}
              className="rounded bg-classhi-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Create Market
            </button>
          )}
        </div>

        {loading && (
          <p className="text-center text-gray-500">Loading markets...</p>
        )}

        {!loading && error && (
          <p className="text-center text-classhi-coral">Failed to load markets.</p>
        )}

        {!loading && !error && openMarkets.length === 0 && (
          <p className="text-center text-gray-500">No open markets yet.</p>
        )}

        {!loading && !error && openMarkets.length > 0 && (
          <div className="flex flex-col gap-4">
            {openMarkets.map((market) => (
              <div
                key={market.marketId}
                onClick={() => navigate('/markets/' + market.marketId)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <span className="text-base font-semibold text-[#111111]">
                    {market.title}
                  </span>
                  <span className="ml-4 shrink-0 text-sm text-gray-500">
                    {formatTimeLeft(market.closeAt)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="rounded px-3 py-1 text-sm font-semibold bg-classhi-green text-white">
                    YES {market.yesPrice}¢
                  </span>
                  <span className="rounded px-3 py-1 text-sm font-semibold bg-classhi-coral text-white">
                    NO {market.noPrice}¢
                  </span>
                  <span className="ml-auto text-sm text-gray-500">
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
