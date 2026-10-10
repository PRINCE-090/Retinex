import { useEffect } from 'react'
import ResponsiveHeroBanner from '../components/ui/responsive-hero-banner'
import StatsWall from '../components/landing/StatsWall'
import HowItWorks from '../components/landing/HowItWorks'
import TeamRoles from '../components/landing/TeamRoles'
import WorkflowScrub from '../components/landing/WorkflowScrub'
import CaseGallery from '../components/landing/CaseGallery'
import ClosingCTA from '../components/landing/ClosingCTA'
import { createSmoothScroll } from '../lib/scroll'
import { getToken } from '../lib/auth'

export default function Landing() {
  useEffect(() => createSmoothScroll(), [])

  // Single real entry point: already signed in -> straight to the
  // workstation; otherwise -> sign in first.
  const workstationHref = getToken() ? '/dashboard' : '/login'

  return (
    <div className="bg-neutral-950">
      <ResponsiveHeroBanner
        logo={
          <span className="text-lg font-semibold tracking-tight text-white">
            Retinex
          </span>
        }
        badgeText=""
        title="Retinex"
        titleLine2="Clarity in every scan. Confidence in every diagnosis."
        description=""
        primaryButtonText="Open Workstation"
        primaryButtonHref={workstationHref}
        secondaryButtonText=""
        ctaButtonText=""
        ctaButtonHref={workstationHref}
        navLinks={[]}
        partners={[]}
      />
      <StatsWall />
      <HowItWorks />
      <WorkflowScrub />
      <TeamRoles />
      <CaseGallery />
      <ClosingCTA />
    </div>
  )
}
