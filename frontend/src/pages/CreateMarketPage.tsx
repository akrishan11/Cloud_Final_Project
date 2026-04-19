import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';
import { NavBar } from '../components/NavBar';

export function CreateMarketPage() {
  const navigate = useNavigate();
  const { idToken, signOut } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [openAt, setOpenAt] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/markets', idToken, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          openAt: new Date(openAt).toISOString(),
          closeAt: new Date(closeAt).toISOString(),
        }),
      });
      if (res.status === 201 || res.ok) {
        navigate('/markets');
        return;
      }
      if (res.status === 403) {
        setError('Admin access required.');
        return;
      }
      setError('Failed to create market. Please try again.');
    } catch {
      setError('Failed to create market. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#111111] outline-none focus:border-classhi-green dark:border-dark-border dark:bg-[#1e1e20] dark:text-white dark:placeholder:text-[#8A8A90] dark:focus:border-classhi-green';
  const labelClass = 'mb-1 block text-sm font-medium text-[#111111] dark:text-white';

  return (
    <div className="min-h-screen bg-classhi-bg dark:bg-dark-bg">
      <NavBar onSignOut={handleSignOut} />

      <div className="mx-auto max-w-lg px-6 py-8">
        <button
          type="button"
          onClick={() => navigate('/markets')}
          className="mb-6 text-sm text-gray-500 hover:text-[#111111] dark:text-[#8A8A90] dark:hover:text-white"
        >
          ← Markets
        </button>

        <div className="rounded-lg border border-gray-200 bg-white p-8 dark:border-dark-border dark:bg-dark-card">
          <h1 className="mb-6 text-xl font-condensed font-semibold text-[#111111] dark:text-white">Create Market</h1>

          {error && (
            <p className="mb-4 text-sm text-classhi-coral">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="title">
                Title
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="How many times will professor say 'AWS'?"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                placeholder="Market resolves based on lecture recording."
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="openAt">
                Opens at
              </label>
              <input
                id="openAt"
                type="datetime-local"
                required
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="closeAt">
                Closes at
              </label>
              <input
                id="closeAt"
                type="datetime-local"
                required
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-lg bg-classhi-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Market'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
