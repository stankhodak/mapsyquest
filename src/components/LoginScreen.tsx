import { useState, type FormEvent } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

interface LoginScreenProps {
  onBack: () => void;
}

type Mode = 'sign-in' | 'sign-up';

const PASSWORD_HINT = 'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.';
// No special-character requirement by design — see PASSWORD_HINT above.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function LoginScreen({ onBack }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
        <h2 className="text-xl font-bold text-slate-100">Login</h2>
        <p>Login isn't set up yet — check back soon.</p>
        <button type="button" onClick={onBack} className="text-sm text-slate-400 underline hover:text-slate-200">
          Return to main screen
        </button>
      </div>
    );
  }

  async function handleGoogleLogin() {
    setError(null);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'sign-up') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!PASSWORD_PATTERN.test(password)) {
        setError(`Password must be: ${PASSWORD_HINT}`);
        return;
      }
    }

    setIsSubmitting(true);
    const { error } =
      mode === 'sign-in'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({
            email,
            password,
            // Falls back to the email as the display name when left blank — see the
            // account-badge logic in App.tsx that reads this same nickname field.
            options: { data: { nickname: nickname.trim() || undefined } },
          });
    setIsSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (mode === 'sign-up') {
      setInfo('Check your email to confirm your account.');
    } else {
      onBack();
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 text-left text-sm text-slate-300">
      <h2 className="text-xl font-bold text-slate-100">{mode === 'sign-in' ? 'Log in' : 'Create account'}</h2>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
        <div className="h-px flex-1 bg-slate-800" />
        or
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'sign-up' && (
          <input
            type="text"
            maxLength={30}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (optional)"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        )}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={mode === 'sign-up' ? 8 : 6}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 pr-10 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-emerald-300"
          >
            👁
          </button>
        </div>

        {mode === 'sign-up' && (
          <>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 pr-10 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-emerald-300"
              >
                👁
              </button>
            </div>
            <p className="text-xs text-slate-500">{PASSWORD_HINT}</p>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="text-sm text-emerald-400">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          {mode === 'sign-in' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((prev) => (prev === 'sign-in' ? 'sign-up' : 'sign-in'));
          setConfirmPassword('');
          setNickname('');
          setError(null);
          setInfo(null);
        }}
        className="block text-sm text-emerald-300 underline hover:text-emerald-200"
      >
        {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>

      <button type="button" onClick={onBack} className="block text-sm text-slate-400 underline hover:text-slate-200">
        Return to main screen
      </button>
    </div>
  );
}
