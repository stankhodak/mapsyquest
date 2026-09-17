import { useState, type FormEvent } from 'react';
import { submitFeedback, type FeedbackCategory } from '../lib/feedback';

interface FeedbackScreenProps {
  onBack: () => void;
  userEmail: string | null;
  userId: string | null;
}

const CATEGORIES: { value: FeedbackCategory; emoji: string; label: string; classes: string }[] = [
  { value: 'thanks', emoji: '👍', label: 'Thanks', classes: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' },
  { value: 'bug', emoji: '🐛', label: 'Bug', classes: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
  { value: 'other', emoji: '💡', label: 'Something else', classes: 'border-sky-500/40 bg-sky-500/15 text-sky-300' },
];

const MESSAGE_MAX_LENGTH = 500;
// Soft anti-spam: blocks rapid repeat submissions from the same browser. Not a real
// spam defense (a determined bot ignores localStorage), just a courtesy speed bump
// alongside asking nicely in the copy below.
const RESUBMIT_COOLDOWN_MS = 60_000;
const LAST_SUBMIT_KEY = 'mapsyquest:lastFeedbackAt';

export function FeedbackScreen({ onBack, userEmail, userId }: FeedbackScreenProps) {
  const [category, setCategory] = useState<FeedbackCategory>('thanks');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState(userEmail ?? '');
  const [website, setWebsite] = useState(''); // honeypot — real players never see or fill this
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (website.trim() !== '') {
      // Bot filled the honeypot — pretend success without actually submitting anything.
      setIsSubmitted(true);
      return;
    }

    let lastSubmitAt = 0;
    try {
      lastSubmitAt = Number(window.localStorage.getItem(LAST_SUBMIT_KEY) ?? 0);
    } catch {
      // Ignore — private browsing, blocked storage, etc.
    }
    if (Date.now() - lastSubmitAt < RESUBMIT_COOLDOWN_MS) {
      setError("You've just sent feedback — give it a minute before sending more.");
      return;
    }

    setIsSubmitting(true);
    const { error: submitError } = await submitFeedback({
      category,
      message: message.trim(),
      contactEmail: contactEmail.trim() || null,
      userId,
    });
    setIsSubmitting(false);

    if (submitError) {
      setError(submitError);
      return;
    }
    try {
      window.localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
    } catch {
      // Ignore
    }
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 text-center">
        <p className="text-4xl">💌</p>
        <h2 className="text-xl font-bold text-slate-100">Thanks for the feedback!</h2>
        <p className="text-sm text-slate-400">We read every message — really appreciate you taking the time.</p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-5 text-left text-sm text-slate-300">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Feedback</h2>
        <p className="mt-1 text-sm text-slate-400">
          Got a bug to report, something that felt off, or just want to say hi? We'd love to hear it — please
          don't use this to spam us though! 🙂
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                category === c.value ? c.classes : 'border-slate-700 bg-slate-900/60 text-slate-500'
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <textarea
          required
          minLength={5}
          maxLength={MESSAGE_MAX_LENGTH}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <p className="-mt-1 text-right text-xs text-slate-500">
          {message.length}/{MESSAGE_MAX_LENGTH}
        </p>

        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Your email (optional, if you'd like a reply)"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />

        {/* Honeypot: hidden from real players via CSS, but visible to naive bots that fill every field. */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden="true"
        />

        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg transition hover:scale-[1.02] hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          Send feedback
        </button>
      </form>

      <button type="button" onClick={onBack} className="block text-sm text-slate-400 underline hover:text-slate-200">
        Return to main screen
      </button>
    </div>
  );
}
