import { Home, ScanEye, Pill } from 'lucide-react'
import { useEffect } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { usePatientPrefs, readPrefs } from '../lib/patientPrefs'
import type { Language } from '../lib/i18n'
import RoleShell from '../components/layout/RoleShell'
import { BACKGROUNDS } from '../lib/roleBackgrounds'

const links = [
  { href: '/patient', label: 'Home', icon: Home, exact: true },
  { href: '/patient/scans', label: 'My Scans', icon: ScanEye },
  { href: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
]

export default function PatientLayout() {
  const { user, currentPatientId, language, setLanguage } = useWorkflow()
  const { prefs, update } = usePatientPrefs(currentPatientId)

  // Restore the saved language once per patient, then keep it saved
  // whenever it changes (the dropdown on the pages also changes it).
  useEffect(() => {
    if (!currentPatientId) return
    const saved = readPrefs(currentPatientId).language
    if (saved !== language) setLanguage(saved as Language)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPatientId])
  useEffect(() => {
    if (currentPatientId && readPrefs(currentPatientId).language !== language) update({ language: language as Language })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Large text scales every rem-based Tailwind size; restored on leave.
  useEffect(() => {
    if (!prefs.largeText) return
    const prev = document.documentElement.style.fontSize
    document.documentElement.style.fontSize = '125%'
    return () => {
      document.documentElement.style.fontSize = prev
    }
  }, [prefs.largeText])
  const patientName = user?.name ?? 'Patient'
  return (
    <RoleShell
      title="Retinex"
      subtitle="Patient Portal"
      links={links}
      {...BACKGROUNDS.patient}
      accent="sky"
      logoutTo="/login/role-selection"
      role="patient"
      className={prefs.highContrast ? 'hc-mode' : ''}
      userName={patientName}
    />
  )
}
