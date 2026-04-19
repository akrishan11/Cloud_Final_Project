import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from 'aws-amplify/auth';

export function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
          autoSignIn: true,
        },
      });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        navigate('/confirm', { state: { email } });
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'UsernameExistsException') {
        setError('An account with this email already exists. Log in instead.');
      } else if (e.name === 'InvalidPasswordException') {
        setError(e.message ?? 'Password must be at least 8 characters and include uppercase, lowercase, and a number.');
      } else {
        setError(e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-classhi-bg dark:bg-dark-bg">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 dark:border-dark-border dark:bg-dark-card">
        <h1 className="text-2xl font-condensed font-bold tracking-tight leading-tight text-[#111111] dark:text-white">
          Create your account
        </h1>
        <p className="mt-2 text-base text-gray-500 dark:text-[#8A8A90]">
          Join Classhi and start predicting.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-[#111111] dark:text-white"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="abc123@pitt.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-[#111111] placeholder:text-gray-500 outline-2 focus:outline-classhi-green dark:border-dark-border dark:bg-[#1e1e20] dark:text-white dark:placeholder:text-[#8A8A90] dark:focus:border-classhi-green"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[#111111] dark:text-white"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8+ chars, uppercase, lowercase, number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-[#111111] placeholder:text-gray-500 outline-2 focus:outline-classhi-green dark:border-dark-border dark:bg-[#1e1e20] dark:text-white dark:placeholder:text-[#8A8A90] dark:focus:border-classhi-green"
            />
          </div>

          {error && (
            <p className="mt-2 text-sm text-classhi-coral" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            aria-disabled={loading}
            className="mt-2 w-full rounded-lg bg-classhi-green px-4 py-3 text-base font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-[#8A8A90]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-classhi-green hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
