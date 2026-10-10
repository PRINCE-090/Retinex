import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Wires Lenis (smooth scroll) and GSAP's ticker/ScrollTrigger together so
 * scrub/pin animations stay in sync with the smoothed scroll position
 * instead of the raw (jumpy) native scroll event.
 */
export function createSmoothScroll() {
  const lenis = new Lenis({
    smoothWheel: !prefersReducedMotion(),
    duration: 1.1,
  })

  const onScroll = () => ScrollTrigger.update()
  lenis.on('scroll', onScroll)

  const tick = (time: number) => lenis.raf(time * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  return () => {
    gsap.ticker.remove(tick)
    lenis.off('scroll', onScroll)
    lenis.destroy()
  }
}

export { gsap, ScrollTrigger }
