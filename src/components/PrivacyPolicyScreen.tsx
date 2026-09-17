interface PrivacyPolicyScreenProps {
  onBack: () => void;
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

export function PrivacyPolicyScreen({ onBack }: PrivacyPolicyScreenProps) {
  return (
    <div className="mx-auto w-full max-w-md space-y-5 text-left text-sm text-slate-300">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Privacy Policy</h2>
        <p className="text-xs text-slate-500">Last updated: September 17, 2026</p>
      </div>

      <p>
        MapsyQuest respects your privacy. This Privacy Policy explains what information we collect, how we use it,
        and the choices available to you when you play MapsyQuest.
      </p>

      <div className="space-y-1 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="font-semibold text-slate-200">Looking ahead</p>
        <p>
          Creating an account currently just identifies you (email, or your Google name/photo, and an optional
          nickname) — your game progress stays local to your browser. As we build out more features, logging in
          may come to mean we track and store your progress, statistics, and other account-related data on our
          servers. We're telling you this now so it's not a surprise later.
        </p>
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
              <span className="font-semibold text-slate-200">Game data:</span> your daily progress, stars,
              points, and streak. This currently lives entirely in your own browser's local storage — it is not
              sent to or stored on our servers, and isn't tied to your account even if you're logged in (see
              "Looking ahead" above).
            </>,
            <>
              <span className="font-semibold text-slate-200">Usage information:</span> technical and analytics
              information about how the game is accessed and used — device, browser, general location (typically
              country-level), pages viewed, and which features get used. Collected via Vercel Web Analytics and
              PostHog (hosted in the EU).
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
            'Account data is retained until you ask us to delete it.',
            "Game progress and streak, stored locally in your browser, are retained until you clear your browser's site data for MapsyQuest — we have no way to do this for you remotely.",
            "Analytics data is retained according to Vercel's and PostHog's own retention practices.",
          ]}
        />
      </div>

      <div className="space-y-2">
        <SectionHeading>Your choices</SectionHeading>
        <BulletList
          items={[
            'You can play MapsyQuest without ever creating an account.',
            "You can clear your browser's site data at any time to remove your locally-stored progress and streak.",
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
