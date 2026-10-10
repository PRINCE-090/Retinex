import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../../lib/scroll'

interface Role {
  label: string
  headline: string
  description: string
}

// Sourced from the Retinex SIH 2026 project report, Section 3.1 (Team
// responsibilities).
const ROLES: Role[] = [
  {
    label: 'AI / DL',
    headline: 'The deep learning core',
    description:
      'EfficientNet-B0 classification, U-Net lesion and vessel segmentation, Grad-CAM explainability, and confidence calibration — evaluated on held-out IDRiD and DRIVE test data.',
  },
  {
    label: 'Image Processing',
    headline: 'The MATLAB quality gate',
    description:
      'Blur, illumination, and field-of-view checks, CLAHE enhancement, and optic disc/fovea localization — built with the MATLAB Image Processing and Computer Vision Toolboxes.',
  },
  {
    label: 'MATLAB / Simulink',
    headline: 'Modeling deployment at scale',
    description:
      'A discrete-event Simulink simulation of the telemedicine pipeline — acquisition, bandwidth, throughput, doctor capacity — sized for 100,000+ patients a year.',
  },
  {
    label: 'Backend',
    headline: 'The data and API layer',
    description:
      'Express and MongoDB behind the AI pipeline. Upload handling and the schema are built; authentication and live-database testing are still in progress.',
  },
  {
    label: 'Frontend',
    headline: 'The doctor-facing view',
    description:
      'The screening dashboard, Grad-CAM and lesion overlays, and automated reports — built to surface every caveat in the result, not just the grade.',
  },
]

export default function TeamRoles() {
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const pillRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tab = tabRefs.current[active]
    const pill = pillRef.current
    if (!tab || !pill) return
    gsap.to(pill, {
      x: tab.offsetLeft,
      width: tab.offsetWidth,
      duration: prefersReducedMotion() ? 0 : 0.45,
      ease: 'power3.out',
    })
  }, [active])

  useEffect(() => {
    if (!contentRef.current) return
    if (prefersReducedMotion()) {
      gsap.set(contentRef.current, { autoAlpha: 1, y: 0 })
      return
    }
    gsap.fromTo(
      contentRef.current,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' },
    )
  }, [active])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) return
      gsap.from(section.querySelectorAll('.reveal'), {
        autoAlpha: 0,
        y: 30,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 75%', toggleActions: 'play none none reverse' },
      })
    }, section)
    return () => ctx.revert()
  }, [])

  // Pin the section and step through roles as the visitor scrolls, instead
  // of requiring a click. Desktop only — a pinned scrub reads as janky on
  // mobile, where the tabs stay click-driven.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    if (prefersReducedMotion()) return

    const mm = gsap.matchMedia()
    mm.add('(min-width: 768px)', () => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: `+=${ROLES.length * 60}%`,
        pin: true,
        scrub: 1,
        snap: 1 / (ROLES.length - 1),
        onUpdate: (self) => {
          const idx = Math.min(ROLES.length - 1, Math.floor(self.progress * ROLES.length))
          setActive((prev) => (prev === idx ? prev : idx))
        },
      })
      return () => trigger.kill()
    })

    return () => mm.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative bg-neutral-950 px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="reveal font-instrument-serif text-4xl text-white sm:text-5xl">Five disciplines, one pipeline</h2>
        <p className="reveal mt-4 text-white/60">Keep scrolling — each discipline gets its turn.</p>

        <div className="reveal relative mx-auto mt-10 inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          <div ref={pillRef} className="pointer-events-none absolute inset-y-1 left-0 rounded-full bg-white" />
          {ROLES.map((role, i) => (
            <button
              key={role.label}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              onClick={() => setActive(i)}
              className={`relative z-10 rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors ${
                active === i ? 'text-neutral-900' : 'text-white/70 hover:text-white'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>

        <div ref={contentRef} className="mx-auto mt-12 max-w-xl">
          <h3 className="font-instrument-serif text-2xl text-white sm:text-3xl">{ROLES[active].headline}</h3>
          <p className="mt-4 text-white/60">{ROLES[active].description}</p>
        </div>
      </div>
    </section>
  )
}
