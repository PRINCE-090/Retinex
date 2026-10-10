import { Users, History } from 'lucide-react'
import RoleShell from '../components/layout/RoleShell'
import type { NotificationItem } from '../components/layout/NotificationBell'
import { BACKGROUNDS } from '../lib/roleBackgrounds'

const links = [
  { href: '/technician', label: 'Live Roster', icon: Users, exact: true },
  { href: '/technician/history', label: 'Scan History', icon: History },
]

const notifications: NotificationItem[] = [
  { kind: 'success', title: 'AI Processing Complete', body: 'Scans for Priya Devi (PT-9013) analyzed and forwarded to Dr. Sharma.', time: 'Just now' },
  { kind: 'urgent', title: 'Urgent Case Assigned', body: 'Ramesh Kumar flagged with high referable probability. Priority review requested.', time: '10 mins ago' },
  { kind: 'info', title: 'System Update', body: 'Retinex Core v2.4 deployed. Security protocols updated.', time: '1 hour ago' },
]

export default function TechnicianLayout() {
  return (
    <RoleShell
      title="Retinex"
      subtitle="Tech Portal"
      links={links}
      {...BACKGROUNDS.technician}
      accent="violet"
      logoutTo="/login"
      logoutLabel="Sign Out"
      role="technician"
      notifications={notifications}
    />
  )
}
