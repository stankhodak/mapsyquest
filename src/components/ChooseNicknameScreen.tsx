import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ChooseNicknameScreenProps {
  /** The name Google shared, shown as a greeting and used if the player skips. */
  suggestedName: string;
  onDone: () => void;
}

/** Shown once after a player's first Google sign-in, since that flow never goes through
 * LoginScreen's own nickname field. Skipping (or closing) is fine — either way we mark
 * user_metadata.nicknamePrompted so this doesn't nag on every future login. */
export function ChooseNicknameScreen({ suggestedName, onDone }: ChooseNicknameScreenProps) {
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveAndFinish(chosenNickname: string | undefined) {
    setIsSubmitting(true);
    const { error } = await supabase!.auth.updateUser({
      data: { nickname: chosenNickname, nicknamePrompted: true },
    });
    setIsSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 text-left text-sm text-slate-300">
      <h2 className="text-xl font-bold text-slate-100">Welcome, {suggestedName}!</h2>
      <p>Want to play under a nickname instead? You can always change your mind later.</p>

      <input
        type="text"
        maxLength={30}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Nickname (optional)"
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
      />

      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => saveAndFinish(nickname.trim() || undefined)}
          className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          Save
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => saveAndFinish(undefined)}
          className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
