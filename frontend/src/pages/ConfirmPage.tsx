import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmSignUp, autoSignIn, resendSignUpCode } from 'aws-amplify/auth';
import { useAuth } from '../auth/AuthContext';

export function ConfirmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();

  const email = (location.state as { email?: string } | null)?.email ?? '';

  if (!email) {
    navigate('/signup', { replace: true });
    return null;
  }

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { nextStep } = await confirmSignUp({
        username: email,
        confirmationCode: code,
      });

      if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
        await autoSignIn();
        await refreshSession();
        navigate('/home', { replace: true });
      } else {
        // Fallback: nextStep.signUpStep === 'DONE'
        navigate('/login', { replace: true });
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'CodeMismatchException') {
        setError('Incorrect code. Please check your email and try again.');
      } else if (e.name === 'ExpiredCodeException') {
        setError("Code expired. Click 'Resend code' to get a new one.");
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendSignUpCode({ username: email });
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch {
      // silently ignore resend errors
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-classhi-bg dark:bg-dark-bg">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 dark:border-dark-border dark:bg-dark-card">
        <h1 className="text-2xl font-condensed font-bold tracking-tight leading-tight text-[#111111] dark:text-white">
          Check your email
        </h1>
        <p className="mt-2 text-base text-gray-500 dark:text-[#8A8A90]">
          We sent a 6-digit code to {email}.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-semibold text-[#111111] dark:text-white"
            >
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
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
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-[#8A8A90]">
          Didn&apos;t get the code?{' '}
          <button
            type="button"
            onClick={handleResend}
            className="text-sm font-semibold text-classhi-green hover:underline"
          >
            Resend code
          </button>
          {resent && (
            <span className="ml-2 text-sm text-classhi-green">Code resent.</span>
          )}
        </p>
      </div>
    </div>
  );
}
