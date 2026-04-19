// Usage: <NavBar onSignOut={handleSignOut} />
// Reads email, balance, isAdmin from useAuth() internally.
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from './ThemeToggle';

interface NavBarProps {
  onSignOut: () => void;
}

export function NavBar({ onSignOut }: NavBarProps) {
  const navigate = useNavigate();
  const { email, balance, isAdmin } = useAuth();

  return (
    <nav className="border-b border-gray-200 bg-white px-6 py-3 dark:border-dark-border dark:bg-dark-card">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <span
          className="cursor-pointer text-xl font-condensed font-bold tracking-wide text-[#111111] dark:text-white"
          onClick={() => navigate('/markets')}
        >
          Classhi
        </span>

        <div className="flex items-center gap-4">
          {email && (
            <span className="text-sm text-gray-500 dark:text-[#8A8A90]">
              {email}
              {balance !== null && (
                <span className="ml-2 font-ticker font-semibold text-[#111111] dark:text-white">
                  — ${balance.toLocaleString()}
                </span>
              )}
            </span>
          )}

          <button
            type="button"
            onClick={() => navigate('/markets')}
            className="text-sm font-semibold text-[#111111] hover:underline dark:text-white"
          >
            Markets
          </button>

          <button
            type="button"
            onClick={() => navigate('/portfolio')}
            className="text-sm font-semibold text-[#111111] hover:underline dark:text-white"
          >
            Portfolio
          </button>

          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="text-sm font-semibold text-[#111111] hover:underline dark:text-white"
          >
            Leaderboard
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin/create-market')}
              className="text-sm font-semibold text-[#111111] hover:underline dark:text-white"
            >
              Create Market
            </button>
          )}

          <ThemeToggle />

          <button
            type="button"
            onClick={onSignOut}
            className="text-sm font-semibold text-classhi-coral hover:underline"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
