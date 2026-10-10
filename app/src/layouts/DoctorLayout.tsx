import { ListTodo, Users, FileSignature } from 'lucide-react'
import RoleShell from '../components/layout/RoleShell'
import type { NotificationItem } from '../components/layout/NotificationBell'
import { BACKGROUNDS } from '../lib/roleBackgrounds'

const links = [
  { href: '/doctor', label: "Today's Queue", icon: ListTodo, exact: true },
  { href: '/doctor/patients', label: 'Patient Database', icon: Users },
  { href: '/doctor/templates', label: 'Clinical Templates', icon: FileSignature },
]

const notifications: NotificationItem[] = [
  { kind: 'success', title: 'Report Finalized', body: 'The report for Priya Devi (PT-9013) was sent to the patient.', time: 'Just now' },
  { kind: 'urgent', title: 'Urgent Case Waiting', body: 'Ramesh Kumar flagged with high referable probability. Priority review requested.', time: '10 mins ago' },
  { kind: 'info', title: 'System Update', body: 'Retinex Core v2.4 deployed. Security protocols updated.', time: '1 hour ago' },
]

export default function DoctorLayout() {
  return (
    <RoleShell
      title="Retinex"
      subtitle="Doctor Portal"
      links={links}
      {...BACKGROUNDS.doctor}
      accent="emerald"
      logoutTo="/login/role-selection"
      role="doctor"
      notifications={notifications}
    />
  )
}
