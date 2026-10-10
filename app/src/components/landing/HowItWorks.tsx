import { useEffect, useMemo, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../../lib/scroll'
import { makeFundusCanvas } from '../../lib/fundusCanvas'

interface Step {
  index: string
  word: string
  title: string
  description: string
  seed: string
  gradcam?: boolean
}

const STEPS: Step[] = [
  {
    index: '01',
    word: 'ASSESS',
    title: 'A MATLAB quality gate',
    description:
      'A fundus pair is checked for sharpness, illumination, and field of view; borderline images get CLAHE enhancement; the optic disc and fovea are localized — before anything reaches the AI stage.',
    seed: 'landing-upload',
  },
  {
    index: '02',
    word: 'CLASSIFY',
    title: 'An ensemble grades severity',
    description:
      'EfficientNet-B0, ResNet50, and DenseNet121 vote on a 5-level ICDR grade (0–4) and a calibrated referable-DR probability — evaluated on held-out data, not the training set.',
    seed: 'landing-analyze',
  },
  {
    index: '03',
    word: 'EXPLAIN',
    title: 'Grad-CAM and segmentation',
    description:
      'Attention maps, per-lesion segmentation masks, and a vessel map accompany the grade — each carrying its own measured reliability, not one blended confidence score.',
    seed: 'landing-map',
    gradcam: true,
  },
  {
    index: '04',
    word: 'REPORT',
    title: 'One result, caveats included',
    description:
      'Every stage writes into one shared, versioned result — rendered as a doctor-facing report that carries the known limitations forward instead of hiding them in a log.',
    seed: 'landing-report',
  },
]

function MaskedWord({ word, seed, gradcam }: { word: string; seed: string; gradcam?: boolean }) {
  const bg = useMemo(() => makeFundusCanvas(seed, { size: 640, gradcam }).toDataURL(), [seed, gradcam])

  return (
    <span
      className="block select-none font-sans text-[16vw] font-black leading-[0.85] tracking-tighter sm:text-[9vw] lg:text-[7vw]"
      style={{
        backgroundImage: `url(${bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      {word}
    </span>
  )
}

export default function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('.step-row')
      rows.forEach((row) => {
        const text = row.querySelector('.step-text')
        const visual = row.querySelector('.step-visual')

        if (prefersReducedMotion()) return

        gsap.from(text, {
          autoAlpha: 0,
          y: 40,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: row, start: 'top 75%', toggleActions: 'play none none reverse' },
        })
        gsap.from(visual, {
          autoAlpha: 0,
          scale: 0.85,
          skewY: 4,
          duration: 1.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: row, start: 'top 75%', toggleActions: 'play none none reverse' },
        })
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative bg-neutral-950 px-6 py-28 sm:py-36">
      <div className="mx-auto mb-16 max-w-3xl sm:mb-24">
        <h2 className="font-instrument-serif text-4xl text-white sm:text-5xl">How it works</h2>
        <p className="mt-4 text-white/60">A MATLAB + Python pipeline, from raw fundus image to a caveat-carrying report.</p>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-24 sm:gap-32">
        {STEPS.map((step, i) => (
          <div
            key={step.index}
            className={`step-row flex flex-col items-center gap-8 sm:gap-12 md:flex-row ${
              i % 2 === 1 ? 'md:flex-row-reverse' : ''
            }`}
          >
            <div className="step-text flex-1">
              <span className="font-mono text-sm text-white/40">{step.index}</span>
              <h3 className="mt-3 font-instrument-serif text-3xl text-white sm:text-4xl">{step.title}</h3>
              <p className="mt-4 max-w-sm text-white/60">{step.description}</p>
            </div>
            <div className="step-visual flex-1 overflow-hidden">
              <MaskedWord word={step.word} seed={step.seed} gradcam={step.gradcam} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
