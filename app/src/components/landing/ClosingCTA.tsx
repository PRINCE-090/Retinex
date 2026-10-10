import { useEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '../../lib/scroll'
import { DEFAULT_BACKGROUND } from '../ui/responsive-hero-banner'

export default function ClosingCTA() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) return
      gsap.from(section.querySelectorAll('.reveal'), {
        autoAlpha: 0,
        y: 40,
        duration: 1,
        stagger: 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 70%', toggleActions: 'play none none reverse' },
      })
    }, section)
    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[80vh] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 py-28 text-center"
    >
      <img src={DEFAULT_BACKGROUND} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950/85 via-neutral-950/75 to-neutral-950" />

      <div className="relative z-10 flex flex-col items-center">
        <h2 className="reveal font-instrument-serif text-5xl leading-tight text-white sm:text-6xl md:text-7xl">
          Every metric,
          <br />
          measured — not marketed.
        </h2>
        <p className="reveal mt-6 max-w-xl text-white/70">
          Retinex is a Smart India Hackathon 2026 prototype. Explore the screening workstation it's built around.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="reveal mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-sans text-sm font-medium text-neutral-900 transition-colors hover:bg-white/90"
        >
          Open workstation
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
