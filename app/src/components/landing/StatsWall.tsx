interface Stat {
  value: number
  decimals: number
  suffix?: string
  label: string
  color: string
}

// Sourced from the Retinex SIH 2026 project report, Section 1 (Headline
// results) and Section 7 (Consolidated results) — official, held-out
// test-set figures, reported as-is including where they fall short of target.
const STATS: Stat[] = [
  {
    value: 87.5,
    decimals: 1,
    suffix: '%',
    label: 'Referable-DR sensitivity',
    color: '#D97706',
  },
  {
    value: 76.9,
    decimals: 1,
    suffix: '%',
    label: 'Referable-DR specificity',
    color: '#DC2626',
  },
  {
    value: 0.915,
    decimals: 3,
    label: 'Referable-DR ROC-AUC',
    color: '#FFFFFF',
  },
  {
    value: 0.74,
    decimals: 2,
    label: 'Vessel segmentation Dice',
    color: '#059669',
  },
]

const marqueeStats = [...STATS, ...STATS]

export default function StatsWall() {
  return (
    <section className="relative bg-neutral-950 px-6 py-28 sm:py-36">
      <div className="mx-auto mb-12 max-w-5xl sm:mb-16">
        <h2 className="font-instrument-serif text-4xl text-white sm:text-5xl">Results, reported straight</h2>
        <p className="mt-4 text-white/60">
          Measured on the official, held-out IDRiD test set — never used for training or threshold selection.
        </p>
      </div>

      <div
        className="relative -mx-6 overflow-hidden bg-black py-16 sm:py-20 [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
        aria-hidden="true"
      >
        <div
          className="flex w-max animate-marquee-scroll items-center gap-12 sm:gap-20"
        >
          {marqueeStats.map((stat, i) => (
            <div key={`${stat.label}-${i}`} className="flex shrink-0 -rotate-6 flex-col">
              <span
                className="font-display text-[5rem] leading-[0.8] tracking-tight sm:text-[7rem] lg:text-[8.5rem]"
                style={{ color: stat.color }}
              >
                {stat.value.toFixed(stat.decimals)}
                {stat.suffix ?? ''}
              </span>
              <span
                className="-mt-3 max-w-[11ch] font-display text-xl uppercase leading-[0.9] tracking-tight sm:text-2xl lg:text-3xl"
                style={{ color: stat.color }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
