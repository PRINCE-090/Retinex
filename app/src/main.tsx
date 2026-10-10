import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Smooth-scroll (Lenis) + GSAP ScrollTrigger pin sections compute the page's
// real scrollable height asynchronously after mount. If the browser restores
// a prior scroll offset before that happens (reload, back/forward), it can
// land past all currently-rendered content. Take scroll restoration over
// ourselves and start at the top on every load.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}
window.scrollTo(0, 0)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
