import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import { NavBar } from '../components/NavBar';

interface LeaderRow {
  rank: number;
  userId: string;
  email: string;
  balance: number;
}

interface LeaderboardResponse {
  top20: LeaderRow[];
  ownRank: number | null;
  ownBalance: number | null;
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { userId, email, idToken, signOut } = useAuth();
  const [top20, setTop20] = useState<LeaderRow[]>([]);
  const [ownRank, setOwnRank] = useState<number | null>(null);
  const [ownBalance, setOwnBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchLeaderboard() {
      try {
        const res = await apiFetch('/leaderboard', idToken);
        if (!res.ok) throw new Error('non-ok response');
        const data = (await res.json()) as LeaderboardResponse;
        if (!cancelled) {
          setTop20(data.top20 ?? []);
          setOwnRank(data.ownRank);
          setOwnBalance(data.ownBalance);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const isCurrentUser = (rowUserId: string) => rowUserId === userId;
  const rankNumberClass = (rank: number) =>
    rank <= 3
      ? 'w-8 text-sm font-semibold text-classhi-green'
      : 'w-8 text-sm font-semibold text-gray-500 dark:text-[#8A8A90]';
  const rowClass = (rowUserId: string, isLast: boolean) => {
    const base = 'flex items-center py-3 px-4';
    const divider = isLast ? '' : ' border-b border-gray-100 dark:border-dark-border';
    const highlight = isCurrentUser(rowUserId)
      ? ' bg-classhi-green/10 border-l-2 border-classhi-green'
      : '';
    return base + divider + highlight;
  };

  const ownInTop20 = ownRank != null && ownRank <= 20;

  return (
    <div className="min-h-screen bg-classhi-bg dark:bg-dark-bg">
      <NavBar onSignOut={handleSignOut} />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-condensed font-bold tracking-tight text-[#111111] dark:text-white">Leaderboard</h1>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white dark:border-dark-border dark:bg-dark-card">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-[#8A8A90]">Loading leaderboard...</p>
          )}
          {!loading && error && (
            <p className="py-8 text-center text-sm text-classhi-coral">
              Failed to load leaderboard. Please try again.
            </p>
          )}
          {!loading && !error && top20.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-[#8A8A90]">
              No players yet. Place a bet to join the leaderboard.
            </p>
          )}
          {!loading && !error && top20.length > 0 && (
            <div>
              <div className="flex items-center py-2 px-4 border-b border-gray-200 text-sm font-semibold text-gray-500 dark:border-dark-border dark:text-[#8A8A90]">
                <span className="w-8">#</span>
                <span className="flex-1">Player</span>
                <span>Balance</span>
              </div>
              {top20.map((row, idx) => (
                <div
                  key={row.userId}
                  className={rowClass(row.userId, idx === top20.length - 1)}
                  title={isCurrentUser(row.userId) ? 'You' : undefined}
                >
                  <span className={rankNumberClass(row.rank)}>{row.rank}</span>
                  <span className="flex-1 truncate text-sm text-[#111111] dark:text-white">{row.email}</span>
                  <span className="text-sm font-ticker font-semibold text-[#111111] dark:text-white">
                    ${row.balance.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {!loading && !error && ownRank != null && !ownInTop20 && (
          <>
            <p className="mt-6 text-sm font-semibold text-gray-500 uppercase tracking-wide dark:text-[#8A8A90]">
              Your Rank
            </p>
            <section className="mt-2 rounded-lg border border-gray-200 bg-white dark:border-dark-border dark:bg-dark-card">
              <div
                className="flex items-center py-3 px-4 bg-classhi-green/10 border-l-2 border-classhi-green"
                title="You"
              >
                <span className="w-8 text-sm font-semibold text-gray-500 dark:text-[#8A8A90]">{ownRank}</span>
                <span className="flex-1 truncate text-sm text-[#111111] dark:text-white">{email ?? '—'}</span>
                <span className="text-sm font-ticker font-semibold text-[#111111] dark:text-white">
                  ${(ownBalance ?? 0).toLocaleString()}
                </span>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
