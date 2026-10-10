"use client";

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Menu, ArrowRight, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../../lib/scroll'

interface NavLink {
  label: string
  href: string
  isActive?: boolean
}

interface Partner {
  logoUrl: string
  href: string
}

interface ResponsiveHeroBannerProps {
  /** Brand mark shown top-left. Defaults to a plain "Retinex" wordmark. */
  logo?: ReactNode
  backgroundImageUrl?: string
  navLinks?: NavLink[]
  ctaButtonText?: string
  ctaButtonHref?: string
  badgeText?: string
  badgeLabel?: string
  title?: string
  titleLine2?: string
  titleLine3?: string
  description?: string
  primaryButtonText?: string
  primaryButtonHref?: string
  secondaryButtonText?: string
  secondaryButtonHref?: string
  partnersTitle?: string
  partners?: Partner[]
}

/** Close-up of a human eye (Unsplash) — sits under the copy as texture. */
export const DEFAULT_BACKGROUND =
  'https://images.unsplash.com/photo-1494869042583-f6c911f04b4c?auto=format&fit=crop&w=2400&q=80'

function ResponsiveHeroBanner({
  logo = <span className="text-lg font-semibold tracking-tight text-white">Retinex</span>,
  backgroundImageUrl = DEFAULT_BACKGROUND,
  navLinks = [],
  ctaButtonText = 'Open workstation',
  ctaButtonHref = '#',
  badgeLabel = '',
  badgeText = 'AI-assisted diabetic retinopathy screening',
  title = 'Every retina,',
  titleLine2 = 'read in seconds',
  titleLine3 = '',
  description = 'Upload a fundus image — get an ICDR severity grade, a 3D lesion map, and a draft report.',
  primaryButtonText = 'Open workstation',
  primaryButtonHref = '#',
  secondaryButtonText = 'See a diagnostic review',
  secondaryButtonHref = '#',
  partnersTitle = '',
  partners = [],
}: ResponsiveHeroBannerProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const sectionRef = useRef<HTMLElement>(null)
  const bgRef = useRef<HTMLImageElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dissolveRef = useRef<HTMLDivElement>(null)
  const idleAnimRef = useRef<gsap.core.Tween | null>(null)

  useEffect(() => {
    if (bgRef.current) {
      // Set the transform origin explicitly to the center to ensure zoom stays centered
      gsap.set(bgRef.current, { transformOrigin: '50% 50%' })

      // Slow immersive zoom effect
      idleAnimRef.current = gsap.to(bgRef.current, {
        scale: 1.5,
        duration: 15,
        ease: 'none',
        repeat: -1,
        yoyo: true,
      })
    }
    return () => {
      idleAnimRef.current?.kill()
    }
  }, [])

  // Scroll-driven exit: pin the hero briefly and dissolve it to black as the
  // visitor keeps scrolling, so the next section arrives out of darkness
  // rather than just scrolling past a static hero.
  useEffect(() => {
    if (!sectionRef.current || !contentRef.current || !dissolveRef.current) return
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=70%',
        pin: true,
        pinSpacing: true,
        scrub: 1,
        onUpdate: (self) => {
          idleAnimRef.current?.pause()
          if (self.progress <= 0.001) idleAnimRef.current?.resume()
        },
        onLeaveBack: () => idleAnimRef.current?.resume(),
        animation: gsap
          .timeline()
          .to(contentRef.current, { autoAlpha: 0, scale: 0.94, filter: 'blur(6px)', ease: 'none' }, 0)
          .to(dissolveRef.current, { autoAlpha: 1, ease: 'none' }, 0),
      })

      return () => trigger.kill()
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
    e.preventDefault()
    if (!href || href === '#') return

    // Stop the idle background animation
    idleAnimRef.current?.kill()

    const tl = gsap.timeline({
      onComplete: () => {
        navigate(href)
      },
    })

    if (contentRef.current) {
      tl.to(contentRef.current, { opacity: 0, scale: 0.95, duration: 0.4, ease: 'power2.inOut' }, 0)
    }
    if (bgRef.current) {
      tl.to(bgRef.current, { scale: 5, opacity: 0, duration: 0.7, ease: 'power2.inOut', transformOrigin: '50% 50%' }, 0)
    }
  }

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[100dvh] w-full flex-col overflow-hidden bg-neutral-950"
    >
      <img
        ref={bgRef}
        src={backgroundImageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: 'center center' }}
      />
      {/* blend the photo into the page rather than sitting on top of it */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/60 to-neutral-950" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
      <div ref={dissolveRef} className="pointer-events-none absolute inset-0 z-20 bg-neutral-950 opacity-0" />

      <div ref={contentRef} className="relative z-10 flex flex-1 flex-col w-full h-full">
        <header className="relative z-10 shrink-0">
          <div className="mx-6">
            <div className="flex items-center justify-between pt-4">
              <div className="inline-flex items-center">{logo}</div>

              {navLinks.length > 0 ? (
                <>
                  <nav className="hidden items-center gap-2 md:flex">
                    <div className="flex items-center gap-1 rounded-full bg-white/5 px-1 py-1 ring-1 ring-white/10 backdrop-blur">
                      {navLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.href}
                          className={`px-3 py-2 font-sans text-sm font-medium transition-colors hover:text-white ${link.isActive ? 'text-white/90' : 'text-white/80'
                            }`}
                        >
                          {link.label}
                        </a>
                      ))}
                      <a
                        href={ctaButtonHref}
                        onClick={(e) => handleNavigate(e, ctaButtonHref)}
                        className="ml-1 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-sans text-sm font-medium text-neutral-900 transition-colors hover:bg-white/90"
                      >
                        {ctaButtonText}
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </nav>

                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur md:hidden"
                    aria-expanded={mobileMenuOpen}
                    aria-label="Toggle menu"
                  >
                    <Menu className="h-5 w-5 text-white/90" />
                  </button>
                </>
              ) : ctaButtonText ? (
                <a
                  href={ctaButtonHref}
                  onClick={(e) => handleNavigate(e, ctaButtonHref)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-sans text-sm font-medium text-neutral-900 transition-colors hover:bg-white/90"
                >
                  {ctaButtonText}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>

            {navLinks.length > 0 && mobileMenuOpen && (
              <div className="mt-3 rounded-2xl bg-neutral-900/90 p-2 ring-1 ring-white/10 backdrop-blur md:hidden">
                {navLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href}
                    className="block rounded-xl px-3 py-2 font-sans text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
                <a
                  href={ctaButtonHref}
                  onClick={(e) => handleNavigate(e, ctaButtonHref)}
                  className="mt-1 flex items-center justify-between rounded-xl bg-white px-3 py-2 font-sans text-sm font-medium text-neutral-900"
                >
                  {ctaButtonText}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center pb-12">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="animate-fade-slide-in-2 font-instrument-serif text-4xl font-normal leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                {title}
              </h1>

              {[titleLine2, titleLine3].some(Boolean) && (
                <p className="mx-auto mt-5 max-w-2xl animate-fade-slide-in-3 text-xl font-medium text-white/85 sm:text-2xl">
                  {[titleLine2, titleLine3].filter(Boolean).map((line, index) => (
                    <span key={index} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              )}

              {badgeText && (
                <div className="mt-8 inline-flex max-w-full animate-fade-slide-in-3 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl bg-white/10 px-2.5 py-2 ring-1 ring-white/15 backdrop-blur">
                  {badgeLabel && (
                    <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 font-sans text-xs font-medium text-neutral-900">
                      {badgeLabel}
                    </span>
                  )}
                  <span className="font-sans text-sm font-medium text-white/90">{badgeText}</span>
                </div>
              )}

              {description && (
                <p className="mx-auto mt-20 max-w-2xl animate-fade-slide-in-3 text-base text-white/80 sm:text-lg">
                  {description}
                </p>
              )}

              <div className="mt-6 flex animate-fade-slide-in-4 flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <a
                  href={primaryButtonHref}
                  onClick={(e) => handleNavigate(e, primaryButtonHref)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-sans text-sm font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
                >
                  {primaryButtonText}
                  <ArrowRight className="h-4 w-4" />
                </a>
                {secondaryButtonText && (
                  <a
                    href={secondaryButtonHref}
                    onClick={(e) => handleNavigate(e, secondaryButtonHref)}
                    className="inline-flex items-center gap-2 rounded-full bg-transparent px-5 py-3 font-sans text-sm font-medium text-white/90 transition-colors hover:text-white"
                  >
                    {secondaryButtonText}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            {partners.length > 0 && (
              <div className="mx-auto mt-20 max-w-5xl">
                {partnersTitle && (
                  <p className="animate-fade-slide-in-1 text-center text-sm text-white/70">
                    {partnersTitle}
                  </p>
                )}
                <div className="mt-6 grid animate-fade-slide-in-2 grid-cols-2 items-center justify-items-center gap-4 text-white/70 sm:grid-cols-3 md:grid-cols-5">
                  {partners.map((partner, index) => (
                    <a
                      key={index}
                      href={partner.href}
                      className="inline-flex h-[36px] w-[120px] items-center justify-center rounded-full bg-cover bg-center opacity-80 transition-opacity hover:opacity-100"
                      style={{ backgroundImage: `url(${partner.logoUrl})` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ResponsiveHeroBanner
