import type { CookieConsent } from '../lib/cookieConsent';

interface PrivacyPolicyScreenProps {
  onBack: () => void;
  /** Null if the player hasn't chosen yet (the banner is still showing). */
  cookieConsent: CookieConsent | null;
  onAcceptCookies: () => void;
  onRejectCookies: () => void;
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

export function PrivacyPolicyScreen({ onBack, cookieConsent, onAcceptCookies, onRejectCookies }: PrivacyPolicyScreenProps) {
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

      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeading>Cookies</SectionHeading>
        <p>
          MapsyQuest itself doesn't need cookies to work — logging in and your local game data both use browser
          storage, not cookies. The one cookie in play is set by{' '}
          <span className="font-semibold text-slate-200">PostHog</span>, our analytics provider, to recognize your
          browser across visits so we can see usage patterns like drop-off between rounds. It's{' '}
          <span className="font-semibold text-slate-200">off by default</span> and only gets set if you accept it
          below (or from the banner on your first visit). Vercel Web Analytics, the other analytics tool we use,
          doesn't use cookies at all and runs regardless of your choice here.
        </p>
        <p className="text-xs text-slate-500">
          Current choice:{' '}
          <span className="font-semibold text-slate-300">
            {cookieConsent === 'accepted' ? 'Analytics cookie accepted' : cookieConsent === 'rejected' ? 'Necessary only' : 'Not yet chosen'}
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRejectCookies}
            disabled={cookieConsent === 'rejected'}
            className="flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:cursor-default disabled:opacity-50"
          >
            Necessary only
          </button>
          <button
            type="button"
            onClick={onAcceptCookies}
            disabled={cookieConsent === 'accepted'}
            className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400 px-3 py-1.5 text-sm font-bold text-slate-950 disabled:cursor-default disabled:opacity-50"
          >
            Accept analytics cookie
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
              (cookieless, always on) and PostHog (hosted in the EU, uses a cookie, only if you accept it — see
              "Cookies" above).
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
            'You can accept or decline the PostHog analytics cookie at any time in the "Cookies" section above — declining also clears anything it already stored in your browser.',
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
