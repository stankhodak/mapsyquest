import { useState } from 'react';
import {
  acceptAllPreferences,
  COOKIE_CATEGORIES,
  rejectAllPreferences,
  type CookieCategoryId,
  type CookiePreferences,
} from '../lib/cookieConsent';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
  /** Null if the player hasn't chosen yet (the banner is still showing). */
  cookiePreferences: CookiePreferences | null;
  onSaveCookiePreferences: (prefs: CookiePreferences) => void;
}

const CONTACT_EMAIL = 'gamedevestan@gmail.com';

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-base font-semibold text-slate-100">{children}</h3>;
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** One row of the classic cookie-category table: a toggle switch next to its label and
 * description. `disabled` is for a category nothing in the app uses yet (see COOKIE_CATEGORIES). */
function CookieToggle({
  label,
  description,
  checked,
  disabled = false,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-slate-800 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-semibold text-slate-200">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      {onToggle ? (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={onToggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
            checked ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-5' : 'left-0.5'}`}
          />
        </button>
      ) : (
        <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
          Always active
        </span>
      )}
    </li>
  );
}

export function PrivacyPolicyScreen({ onBack, cookiePreferences, onSaveCookiePreferences }: PrivacyPolicyScreenProps) {
  // A local draft so toggles can be flipped before "Save preferences" is pressed, without
  // touching the saved choice (and PostHog) on every click. Re-synced during render (rather
  // than an effect, which would cost an extra render) whenever the saved preferences change
  // out from under this screen — e.g. the cookie banner's own Accept/Reject, still visible
  // underneath this one while no choice has been made yet.
  const [draft, setDraft] = useState<CookiePreferences>(() => cookiePreferences ?? rejectAllPreferences());
  const [syncedFrom, setSyncedFrom] = useState(cookiePreferences);
  if (cookiePreferences !== syncedFrom) {
    setSyncedFrom(cookiePreferences);
    setDraft(cookiePreferences ?? rejectAllPreferences());
  }

  function toggleCategory(id: CookieCategoryId) {
    setDraft((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function applyAndSave(prefs: CookiePreferences) {
    setDraft(prefs);
    onSaveCookiePreferences(prefs);
  }

  const isDirty = cookiePreferences === null || COOKIE_CATEGORIES.some((c) => draft[c.id] !== cookiePreferences[c.id]);
  return (
    <div className="mx-auto w-full max-w-md space-y-5 text-left text-sm text-slate-300">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Privacy Policy</h2>
        <p className="text-xs text-slate-500">Last updated: September 22, 2026</p>
      </div>

      <p>
        MapsyQuest respects your privacy. This Privacy Policy explains what information we collect, how we use it,
        and the choices available to you when you play MapsyQuest.
      </p>

      <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="font-semibold text-slate-200">Account stats</p>
        <p>
          If you're logged in, we save a running summary of your play to your account — games played, your best
          single-game star/point totals, and your current and best streak — so it doesn't disappear if you clear
          your browser or switch devices. Your day-by-day round results (which countries, capitals, and flags you
          were asked and how you answered) always stay local to your browser and are never sent to us, logged in
          or not.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeading>Cookies</SectionHeading>
        <p>
          We only use optional cookies for our own product analytics — never for advertising. Turn any category on
          or off below; it applies as soon as you press "Save preferences".
        </p>
        <ul>
          <CookieToggle
            label="Necessary"
            description="Required for the site to work. MapsyQuest doesn't currently set any of these either — logging in and your local game data both use browser storage, not cookies."
            checked
          />
          {COOKIE_CATEGORIES.map((category) => (
            <CookieToggle
              key={category.id}
              label={category.inUse ? category.label : `${category.label} (not currently used)`}
              description={category.description}
              checked={draft[category.id]}
              disabled={!category.inUse}
              onToggle={() => toggleCategory(category.id)}
            />
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => applyAndSave(rejectAllPreferences())}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Reject all
          </button>
          <button
            type="button"
            onClick={() => applyAndSave(acceptAllPreferences())}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={() => applyAndSave(draft)}
            disabled={!isDirty}
            className="ml-auto rounded-lg bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 disabled:cursor-default disabled:opacity-50"
          >
            Save preferences
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <SectionHeading>Your rights</SectionHeading>
        <p>
          <span className="font-semibold text-slate-200">EU/UK (GDPR):</span> you have the right to access,
          correct, delete, restrict, or receive a copy of your personal data. Contact us anytime to exercise
          these.
        </p>
        <p>
          <span className="font-semibold text-slate-200">US:</span> state privacy laws (like California's
          CCPA/CPRA, and similar laws in other states) may give you the right to know, delete, correct, and opt
          out of the sale of your personal data — we don't sell it regardless. Contact us to exercise these
          rights.
        </p>
      </div>

      <div className="space-y-2">
        <SectionHeading>Information we collect</SectionHeading>
        <BulletList
          items={[
            <>
              <span className="font-semibold text-slate-200">Account information (optional):</span> if you create
              an account, we collect the email address you sign up with, or the name, email, and profile photo
              Google shares if you sign in that way. If you set a nickname, we store that too.
            </>,
            <>
              <span className="font-semibold text-slate-200">Game data:</span> your day-by-day round results
              (which countries, capitals, and flags you were asked, and how you answered) live entirely in your
              own browser's local storage and are never sent to us. If you're logged in, we additionally store a
              running summary tied to your account — games played, best single-game star/point totals, and
              current/best streak (see "Account stats" above). Your achievements progress (which achievements
              you've earned, and counters like games played) is also kept only in your own browser.
            </>,
            <>
              <span className="font-semibold text-slate-200">Leaderboard posts (only if you choose to post):</span>{' '}
              when you press "Add to leaderboard" while logged in, we store the nickname you chose, the score, the
              star total, the game board and date, and the achievements that game earned. Nothing is posted
              unless you press that button.
            </>,
            <>
              <span className="font-semibold text-slate-200">Usage information:</span> technical and analytics
              information about how the game is accessed and used — device, browser, general location (typically
              country-level), pages viewed, and which features get used. Collected via Vercel Web Analytics
              (cookieless, always on) and PostHog (hosted in the EU, uses a cookie — only runs if you turn the
              Analytics category on, see "Cookies" above).
            </>,
          ]}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>How we use information</SectionHeading>
        <BulletList
          items={[
            'Provide, operate, maintain, and improve MapsyQuest.',
            'Create and secure your account and authenticate your access, if you choose to log in.',
            'Understand how the game is used, find and fix problems, and see which features actually get used.',
            'Communicate with you about the service or respond to your requests.',
          ]}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>How we share information</SectionHeading>
        <p>
          We do not sell your personal information. We share information with the service providers that help us
          run MapsyQuest:
        </p>
        <BulletList
          items={[
            <>
              <span className="font-semibold text-slate-200">Supabase</span> — authentication and account
              storage.
            </>,
            <>
              <span className="font-semibold text-slate-200">Google</span> — only if you sign in with Google;
              Google's own privacy policy governs what it shares with us.
            </>,
            <>
              <span className="font-semibold text-slate-200">Vercel</span> — hosting and Vercel Web Analytics.
            </>,
            <>
              <span className="font-semibold text-slate-200">PostHog (EU Cloud)</span> — product analytics.
            </>,
            <>
              <span className="font-semibold text-slate-200">Ko-fi</span> — only if you click Donate; that takes
              you to Ko-fi's own site, governed by Ko-fi's privacy policy, not this one.
            </>,
          ]}
        />
        <p>
          <span className="font-semibold text-slate-200">Leaderboards are public.</span> A score you post, with
          the nickname you chose, is visible to every visitor. We never show your email address or full name on a
          leaderboard: if Google shared your name we only pre-fill its first word in the nickname box, and you
          confirm or change it before posting.
        </p>
        <p>
          We may also disclose information when required by law, to protect rights and safety, or in connection
          with a merger, acquisition, financing, or sale of assets.
        </p>
      </div>

      <div className="space-y-2">
        <SectionHeading>Data storage and security</SectionHeading>
        <p>
          Account data is stored with Supabase, which encrypts data in transit and at rest. We use reasonable
          administrative, technical, and organizational measures designed to protect your information. However,
          no internet transmission or storage system can be guaranteed to be completely secure.
        </p>
      </div>

      <div className="space-y-2">
        <SectionHeading>Data retention</SectionHeading>
        <BulletList
          items={[
            'Account information and your saved stats summary are retained until you ask us to delete them.',
            'Scores you post to a leaderboard are retained until you ask us to delete them.',
            "Your day-by-day round results, stored locally in your browser, are retained until you clear your browser's site data for MapsyQuest — we have no way to do this for you remotely.",
            "Analytics data is retained according to Vercel's and PostHog's own retention practices.",
          ]}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Your choices</SectionHeading>
        <BulletList
          items={[
            'You can play MapsyQuest without ever creating an account.',
            'You can turn each cookie category on or off at any time in the "Cookies" section above — turning Analytics off also clears anything it already stored in your browser.',
            "You can clear your browser's site data at any time to remove your locally-stored day-by-day round results (this doesn't remove your saved account stats — contact us for that).",
            'You can contact us to ask about, correct, or request deletion of your account and any personal information we hold.',
          ]}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Children's privacy</SectionHeading>
        <p>
          MapsyQuest is not directed to children under 13, and we do not knowingly collect personal information
          from children under 13. If you believe a child has provided personal information, please contact us so
          we can take appropriate action.
        </p>
      </div>

      <div className="space-y-2">
        <SectionHeading>Changes to this policy</SectionHeading>
        <p>
          We may update this Privacy Policy from time to time. We will post the revised policy on this page and
          update the date above. Your continued use of the service after a change means the revised policy
          applies.
        </p>
      </div>

      <div className="space-y-2">
        <SectionHeading>Contact us</SectionHeading>
        <p>
          If you have questions or requests concerning this Privacy Policy, contact us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-emerald-300 underline hover:text-emerald-200">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>

      <button type="button" onClick={onBack} className="text-sm text-slate-400 underline hover:text-slate-200">
        Return to main screen
      </button>
    </div>
  );
}
