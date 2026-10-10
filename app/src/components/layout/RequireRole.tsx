import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useWorkflow } from '../../context/WorkflowContext'
import { LOGIN_PATH, type SessionRole } from '../../lib/session'

/** Sends signed-out (or wrong-role) visitors to the matching login page. */
export default function RequireRole({ role, children }: { role: SessionRole; children: ReactNode }) {
  const { user } = useWorkflow()
  if (!user) return <Navigate to={LOGIN_PATH[role]} replace />
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />
  return <>{children}</>
}
