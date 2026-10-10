import { useEffect, useRef } from 'react'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../../lib/scroll'
import idrid070 from '../../assets/fundus/idrid-070.jpg'
import idrid060 from '../../assets/fundus/idrid-060.jpg'
import idrid055 from '../../assets/fundus/idrid-055.jpg'
import fundusExudatesA from '../../assets/fundus/fundus-exudates-a.jpg'
import fundusLesionsA from '../../assets/fundus/fundus-lesions-a.jpg'
import fundusLesionsB from '../../assets/fundus/fundus-lesions-b.jpg'

// Validation Dice per segmentation channel, from the Retinex SIH 2026 report,
// Section 7.2 — reported per channel rather than averaged into one number,
// matching the report's own "dice_unreliable" flag in the shared schema.
const CHANNELS: { label: string; dice: number; backgroundColor: string; image: string }[] = [
  { label: 'Vessel Segmentation', dice: 0.74, backgroundColor: '#86EFAC', image: idrid070 },
  { label: 'Hard Exudates', dice: 0.52, backgroundColor: '#86EFAC', image: fundusExudatesA },
  { label: 'Microaneurysms', dice: 0.28, backgroundColor: '#FCD34D', image: fundusLesionsA },
  { label: 'Haemorrhages', dice: 0.26, backgroundColor: '#FCD34D', image: fundusLesionsB },
  { label: 'Soft Exudates / CWS', dice: 0.15, backgroundColor: '#FCA5A5', image: idrid060 },
  { label: 'Neovascularization', dice: 0.19, backgroundColor: '#FCA5A5', image: idrid055 },
]

function ChannelThumb({ channel }: { channel: (typeof CHANNELS)[number] }) {
  return (
    <div className="case-card group relative flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-[15rem] overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
        <img
          src={channel.image}
          alt=""
          className="relative z-0 h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <span
        className="absolute bottom-0 left-1/2 z-50 max-w-[calc(100%-1rem)] -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white/90 px-4 py-1.5 text-center text-sm font-semibold text-neutral-950 shadow-[0_3px_12px_rgba(0,0,0,0.45)]"
        style={{ backgroundColor: channel.backgroundColor }}
      >
        {channel.label} · {channel.dice.toFixed(2)} Dice
      </span>
    </div>
  )
}

export default function CaseGallery() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) return
      gsap.set('.case-card', { autoAlpha: 0, y: 30 })
      ScrollTrigger.batch('.case-card', {
        start: 'top 90%',
        onEnter: (batch) =>
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }),
        once: true,
      })
    }, section)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative bg-neutral-950 px-6 py-28 sm:py-36">
      <div className="mx-auto mb-12 max-w-3xl sm:mb-16">
        <h2 className="font-instrument-serif text-4xl text-white sm:text-5xl">Every channel, scored honestly</h2>
        <p className="mt-4 text-white/60">
          Validation Dice per segmentation channel — reported the way the shared schema does, not averaged away.
        </p>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10">
        {CHANNELS.map((channel) => (
          <ChannelThumb key={channel.label} channel={channel} />
        ))}
      </div>
    </section>
  )
}
