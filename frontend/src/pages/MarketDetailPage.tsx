import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import { useMarketWS, type PriceUpdate } from '../hooks/useMarketWS';
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

function formatDetailed(closeAt: string): string {
  const diff = new Date(closeAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function StatusBadge({ status }: { status: Market['status'] }) {
  const isOpen = status === 'open';
  return (
    <span
      className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold uppercase ${
        isOpen
          ? 'bg-classhi-green text-white'
          : 'bg-gray-200 text-gray-700 dark:bg-[#28282C] dark:text-gray-300'
      }`}
    >
      {status}
    </span>
  );
}

type Side = 'YES' | 'NO' | null;

export function MarketDetailPage() {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const { idToken, balance, isAdmin, signOut, refreshSession } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const [side, setSide] = useState<Side>(null);
  const [amountText, setAmountText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [flashSide, setFlashSide] = useState<'YES' | 'NO' | 'BOTH' | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [resolving, setResolving] = useState<'YES' | 'NO' | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setMarket((prev) => {
      if (!prev) return prev;
      const yesMoved = update.yesPrice !== prev.yesPrice;
      const noMoved = update.noPrice !== prev.noPrice;
      const newSide: 'YES' | 'NO' | 'BOTH' | null =
        yesMoved && noMoved ? 'BOTH' : yesMoved ? 'YES' : noMoved ? 'NO' : null;
      if (newSide) {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        setFlashSide(newSide);
        flashTimerRef.current = setTimeout(() => setFlashSide(null), 400);
      }
      return { ...prev, yesPrice: update.yesPrice, noPrice: update.noPrice };
    });
  }, []);

  useMarketWS(marketId, idToken, handlePriceUpdate);

  useEffect(() => {
    let cancelled = false;
    async function fetchMarket() {
      try {
        const res = await apiFetch(`/markets/${marketId}`, idToken);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('non-ok response');
        const data = (await res.json()) as { market: Market };
        if (!cancelled) {
          setMarket(data.market);
          setTimeLeft(formatDetailed(data.market.closeAt));
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMarket();
    return () => {
      cancelled = true;
    };
  }, [marketId, idToken]);

  useEffect(() => {
    if (!market) return;
    if (market.status !== 'open' && market.status !== 'scheduled') return;
    const interval = setInterval(() => {
      setTimeLeft(formatDetailed(market.closeAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [market]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg dark:bg-dark-bg">
        <p className="text-gray-500 dark:text-[#8A8A90]">Loading market...</p>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg dark:bg-dark-bg">
        <p className="text-gray-500 dark:text-[#8A8A90]">Market not found.</p>
      </div>
    );
  }
  if (error || !market) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg dark:bg-dark-bg">
        <p className="text-classhi-coral">Failed to load market.</p>
      </div>
    );
  }

  const showCountdown = market.status === 'open' || market.status === 'scheduled';
  const amountNum = Number(amountText);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const sidePrice = side === 'YES' ? market.yesPrice : side === 'NO' ? market.noPrice : null;
  const estimatedShares =
    side && amountValid && sidePrice && sidePrice > 0
      ? Math.round((amountNum / (sidePrice / 100)) * 100) / 100
      : null;
  const estimatedPayout = estimatedShares != null ? estimatedShares * 1.0 : null;
  const exceedsBalance = amountValid && balance != null && amountNum > balance;
  const ctaEnabled = side != null && amountValid && !exceedsBalance && !submitting;
  const isMarketOpen = market.status === 'open';

  async function handleSubmit() {
    if (!ctaEnabled || side == null || !marketId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch(`/markets/${marketId}/bets`, idToken, {
        method: 'POST',
        body: JSON.stringify({ side, amount: amountNum }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(errData.error ?? 'Failed to place bet. Please try again.');
        return;
      }
      const data = (await res.json()) as {
        yesPrice: number;
        noPrice: number;
        newBalance: number | null;
      };
      setMarket({ ...(market as Market), yesPrice: data.yesPrice, noPrice: data.noPrice });
      setSide(null);
      setAmountText('');
      await refreshSession();
    } catch {
      setSubmitError('Failed to place bet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(outcome: 'YES' | 'NO') {
    if (!marketId || resolving !== null) return;
    setResolving(outcome);
    setResolveError(null);
    try {
      const res = await apiFetch(`/markets/${marketId}/resolve`, idToken, {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      });
      if (res.status === 409) {
        setResolveError('This market has already been resolved.');
        return;
      }
      if (res.status === 403) {
        setResolveError('Admin access required.');
        return;
      }
      if (!res.ok) {
        setResolveError('Failed to resolve market. Please try again.');
        return;
      }
      // Success: re-fetch market so status becomes 'resolved' and panel disappears
      const refetch = await apiFetch(`/markets/${marketId}`, idToken);
      if (refetch.ok) {
        const data = (await refetch.json()) as { market: Market };
        setMarket(data.market);
      }
    } catch {
      setResolveError('Failed to resolve market. Please try again.');
    } finally {
      setResolving(null);
    }
  }

  const ctaLabel = submitting
    ? 'Placing bet...'
    : side == null
    ? 'Place a bet'
    : amountValid
    ? `Bet ${side} — $${amountNum}`
    : `Bet ${side}`;
  const ctaBg =
    side === 'YES'
      ? 'bg-classhi-green'
      : side === 'NO'
      ? 'bg-classhi-coral'
      : 'bg-gray-300 dark:bg-[#28282C]';

  return (
    <div className="min-h-screen bg-classhi-bg dark:bg-dark-bg">
      <NavBar onSignOut={handleSignOut} />

      <main className="mx-auto max-w-2xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate('/markets')}
          className="mb-6 text-sm text-gray-500 hover:text-[#111111] dark:text-[#8A8A90] dark:hover:text-white"
        >
          ← Markets
        </button>

        <div className="mb-4">
          <StatusBadge status={market.status} />
        </div>

        <h1 className="text-2xl font-condensed font-bold tracking-tight text-[#111111] dark:text-white">{market.title}</h1>

        {market.description && (
          <p className="mt-2 text-base text-gray-500 dark:text-[#8A8A90]">{market.description}</p>
        )}

        {showCountdown && (
          <p className="mt-3 text-sm text-gray-500 dark:text-[#8A8A90]">Closes in {timeLeft}</p>
        )}

        {isMarketOpen ? (
          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-dark-border dark:bg-dark-card">
            <h2 className="text-xl font-condensed font-semibold text-[#111111] dark:text-white">Place a bet</h2>

            {/* Combined price display + side selector — clicking selects that side */}
            <div aria-live="polite" className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setSide(side === 'YES' ? null : 'YES')}
                className={`flex-1 rounded-full py-2 text-sm font-ticker font-bold transition-all ${
                  flashSide === 'YES' || flashSide === 'BOTH' ? 'animate-flash-green' : ''
                } ${
                  side === 'YES'
                    ? 'bg-classhi-green text-white ring-2 ring-classhi-green ring-offset-2 ring-offset-white dark:ring-offset-dark-card'
                    : 'border-2 border-classhi-green bg-transparent text-classhi-green hover:bg-classhi-green/10'
                }`}
              >
                Yes {market.yesPrice}¢
              </button>
              <button
                type="button"
                onClick={() => setSide(side === 'NO' ? null : 'NO')}
                className={`flex-1 rounded-full py-2 text-sm font-ticker font-bold transition-all ${
                  flashSide === 'NO' || flashSide === 'BOTH' ? 'animate-flash-coral' : ''
                } ${
                  side === 'NO'
                    ? 'bg-classhi-coral text-white ring-2 ring-classhi-coral ring-offset-2 ring-offset-white dark:ring-offset-dark-card'
                    : 'border-2 border-classhi-coral bg-transparent text-classhi-coral hover:bg-classhi-coral/10'
                }`}
              >
                No {market.noPrice}¢
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-[#111111] dark:text-white">Amount</label>
              <input
                type="number"
                min={1}
                step={1}
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="$"
                className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-[#111111] outline-none focus:border-classhi-green dark:border-dark-border dark:bg-[#1e1e20] dark:text-white dark:placeholder:text-[#8A8A90] dark:focus:border-classhi-green"
              />
              {balance != null && (
                <p className="mt-1 text-xs text-gray-500 dark:text-[#8A8A90]">
                  Balance: ${balance.toLocaleString()}
                </p>
              )}
            </div>

            {exceedsBalance && balance != null ? (
              <p className="mt-4 text-sm text-classhi-coral">
                Insufficient balance. Your balance is ${balance.toLocaleString()}.
              </p>
            ) : estimatedShares != null && estimatedPayout != null ? (
              <div className="mt-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-[#8A8A90]">Estimated shares</span>
                  <span className="text-sm font-semibold text-[#111111] dark:text-white">
                    {estimatedShares.toFixed(2)} shares
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-[#8A8A90]">Estimated payout</span>
                  <span className="text-sm font-semibold text-classhi-green">
                    ${estimatedPayout.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}

            {submitError && (
              <p className="mt-3 text-sm text-classhi-coral">{submitError}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!ctaEnabled}
              className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${ctaBg}`}
            >
              {ctaLabel}
            </button>
          </section>
        ) : isAdmin && market.status === 'closed' ? (
          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-dark-border dark:bg-dark-card">
            <h2 className="text-xl font-condensed font-semibold text-[#111111] dark:text-white">Resolve Market</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#8A8A90]">
              Select the winning outcome. This action is irreversible.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => handleResolve('YES')}
                disabled={resolving !== null}
                className="h-11 flex-1 rounded-lg bg-classhi-green text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {resolving === 'YES' ? 'Resolving...' : 'Resolve YES'}
              </button>
              <button
                type="button"
                onClick={() => handleResolve('NO')}
                disabled={resolving !== null}
                className="h-11 flex-1 rounded-lg bg-classhi-coral text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {resolving === 'NO' ? 'Resolving...' : 'Resolve NO'}
              </button>
            </div>
            {resolveError && (
              <p className="mt-3 text-sm text-classhi-coral">{resolveError}</p>
            )}
          </section>
        ) : (
          <p className="mt-6 text-sm text-gray-500 dark:text-[#8A8A90]">Betting is closed for this market.</p>
        )}
      </main>
    </div>
  );
}
