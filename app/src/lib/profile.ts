import { useCallback } from 'react'
import { useWorkflow } from '../context/WorkflowContext'
import { updateProfileApi } from '../api/realApi'

/**
 * Account details of the signed-in user (name shown in the navbar, name +
 * email edited in Settings). Backed by PATCH /api/auth/me; the session in
 * WorkflowContext is updated so the navbar reflects a change immediately.
 */
export type Role = 'patient' | 'doctor' | 'technician' | 'admin'

export interface Profile {
  name: string
  email: string
}

export function useProfile(_role: Role) {
  const { user, token, renameUser } = useWorkflow()

  const profile: Profile = { name: user?.name ?? '', email: user?.email ?? '' }

  /** Throws with the server's message on failure (e.g. email already in use). */
  const save = useCallback(
    async (next: Profile) => {
      if (!token) throw new Error('Not signed in')
      const res = await updateProfileApi({ name: next.name, email: next.email }, token)
      renameUser(res.user.name, res.user.email)
    },
    [token, renameUser],
  )

  return { profile, save }
}
