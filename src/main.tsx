import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import './lib/posthogClient' // side-effect import: starts PostHog if the player already accepted cookies on an earlier visit
import App from './App.tsx'
import { recordSiteHit } from './lib/siteHits'

// Outside React so StrictMode's dev-only double render can't count a load twice.
recordSiteHit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
