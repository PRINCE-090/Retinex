import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../../lib/scroll'
import dashboardShot from '../../assets/screenshots/dashboard.jpg'
import gradcamShot from '../../assets/screenshots/diagnostic-gradcam.jpg'
import simulinkShot from '../../assets/screenshots/simulink-model.jpg'
import schemaShot from '../../assets/screenshots/schema-json.jpg'
import matlabGraphShot from '../../assets/screenshots/matlab-doctor-departures.jpg'

interface Card {
  tag: string
  title: string
  description: string
  colorClass: string
  image: string
}

// Sourced from the Retinex SIH 2026 project report, Sections 3, 5, 6, and 9 —
// real components and their actual, current status, not an idealized product.
const CARDS: Card[] = [
  {
    tag: 'MATLAB',
    title: 'Quality, enhancement, localization',
    description:
      'Sharpness, illumination, and field-of-view checks, CLAHE enhancement, and optic disc/fovea localization — functionally complete for the current demo scope.',
    colorClass: 'bg-healthy',
    image: matlabGraphShot,
  },
  {
    tag: 'Python / PyTorch',
    title: 'Classification & explainability',
    description:
      'One unified inference pipeline chains the classifier, calibration, Grad-CAM, and both segmentation U-Nets into a single structured result per image.',
    colorClass: 'bg-mild',
    image: gradcamShot,
  },
  {
    tag: 'Shared schema',
    title: 'One versioned JSON result',
    description:
      'A meets_target flag and per-channel reliability flags are carried in the result itself, designed to reach the doctor-facing UI, not stay in internal logs.',
    colorClass: 'bg-moderate',
    image: schemaShot,
  },
  {
    tag: 'Simulink',
    title: 'District-scale deployment model',
    description:
      'A discrete-event simulation of acquisition rate, bandwidth, throughput, and doctor review capacity — sized for a 100,000+ patient/year screening program.',
    colorClass: 'bg-severe',
    image: simulinkShot,
  },
  {
    tag: 'Backend & frontend',
    title: 'Express, MongoDB, React',
    description:
      'Upload handling and the schema layer are built. Authentication and live-database testing are still in progress.',
    colorClass: 'bg-proliferative',
    image: dashboardShot,
  },
]

export default function WorkflowScrub() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return
    if (prefersReducedMotion()) return

    const mm = gsap.matchMedia()

    mm.add('(min-width: 768px)', () => {
      const getDistance = () => track.scrollWidth - section.clientWidth

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${getDistance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        animation: gsap.to(track, { x: () => -getDistance(), ease: 'none' }),
      })

      return () => trigger.kill()
    })

    return () => mm.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-neutral-950 py-28 sm:py-36">
      <div className="mx-auto mb-12 max-w-3xl px-6 sm:mb-16">
        <h2 className="font-instrument-serif text-4xl text-white sm:text-5xl">Inside the system</h2>
        <p className="mt-4 text-white/60">Five real components — keep scrolling to see where each one actually stands.</p>
      </div>

      <div
        ref={trackRef}
        className="flex w-max gap-6 px-6 [-ms-overflow-style:none] [scrollbar-width:none] max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map((card) => (
          <div
            key={card.tag}
            className="relative flex h-[60vh] w-[82vw] shrink-0 flex-col justify-end overflow-hidden rounded-2xl bg-white/5 p-8 ring-1 ring-white/10 max-md:snap-center sm:w-[60vw] md:w-[38vw] lg:w-[30vw]"
          >
            <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
            <span
              className={`relative inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold text-neutral-900 ${card.colorClass}`}
            >
              {card.tag}
            </span>
            <h3 className="relative mt-6 font-instrument-serif text-3xl text-white">{card.title}</h3>
            <p className="relative mt-3 text-white/70">{card.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
