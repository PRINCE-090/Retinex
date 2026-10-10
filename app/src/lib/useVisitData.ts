import { useEffect, useState } from 'react'
import { fetchAllRealVisitAssets, getVisit, type RealAssetBundle, type RealVisit } from '../api/realApi'
import type { EyeKey } from '../components/VisitDiagnostics'

/**
 * Loads one visit (full pipeline output) plus every renderable asset
 * (original, Grad-CAM overlay, vessel map, lesion masks) for each eye as
 * authenticated blob URLs. Works for staff and, once a report is
 * finalized, for the patient who owns it.
 */
export function useVisitData(visitId: string | null | undefined, token: string | null) {
  const [visit, setVisit] = useState<RealVisit | null>(null)
  const [assets, setAssets] = useState<Partial<Record<EyeKey, RealAssetBundle>>>({})
  const [loading, setLoading] = useState(!!visitId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visitId || !token) {
      setVisit(null)
      setAssets({})
      setLoading(false)
      return
    }
    let alive = true
    const urls: string[] = []
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const v = await getVisit(visitId, token)
        if (!alive) return
        setVisit(v)

        const bundles: Partial<Record<EyeKey, RealAssetBundle>> = {}
        for (const eye of ['od', 'os'] as EyeKey[]) {
          const r = v[eye]
          if (!r) continue
          try {
            const b = await fetchAllRealVisitAssets(r, v.visit_id, eye, token)
            bundles[eye] = b
            for (const u of [b.originalUrl, b.overlayUrl, b.vesselUrl, ...Object.values(b.lesionUrls)]) if (u) urls.push(u)
          } catch (e) {
            console.warn(`Failed to load ${eye.toUpperCase()} assets:`, e)
          }
        }
        if (alive) setAssets(bundles)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [visitId, token])

  return { visit, assets, loading, error }
}
