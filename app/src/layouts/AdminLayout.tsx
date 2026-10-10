import { Activity, BrainCircuit, History, Users2 } from 'lucide-react'
import RoleShell from '../components/layout/RoleShell'

const links = [
  { href: '/admin', label: 'Platform Overview', icon: Activity, exact: true },
  { href: '/admin/staff', label: 'Staff Directory', icon: Users2 },
  { href: '/admin/insights', label: 'AI Insights', icon: BrainCircuit },
  { href: '/admin/activity', label: 'Activity Log', icon: History },
]

export default function AdminLayout() {
  return (
    <RoleShell
      title="Retinex"
      subtitle="Admin"
      links={links}
      accent="slate"
      // No admin artwork requested -- plain dark backdrop (the image path
      // simply 404s to the base colour if none is added later).
      bgImage="/backgrounds/admin.webp"
      overlay="linear-gradient(135deg, rgba(3, 7, 18, 0.92) 0%, rgba(15, 23, 42, 0.90) 50%, rgba(3, 7, 18, 0.94) 100%)"
      bgColor="#030712"
      logoutTo="/login/admin"
      role="admin"
    />
  )
}
