/**
 * Procedural retinal fundus renderer. Produces a deterministic, vaguely
 * realistic fundus photograph from a string seed — optic disc, macula,
 * branching vasculature, and a faint fibre-layer sheen. A `gradcam` variant
 * bakes a warm saliency wash over the same geometry.
 *
 * Stand-in for the `fundus_url` / `gradcam_url` object-storage assets.
 */

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface FundusOptions {
  size?: number
  gradcam?: boolean
  /** 'OD' places the optic disc left-of-centre, 'OS' right-of-centre */
  eye?: 'OD' | 'OS'
  /** normalized saliency hotspots for the gradcam wash, x/y in [-1,1] */
  hotspots?: { x: number; y: number; size: number }[]
}

const cache = new Map<string, HTMLCanvasElement>()

/**
 * How far a normalized fundus coordinate (|n| = 1) sits from the image centre,
 * as a fraction of the image radius. Shared with `retinaMap.ts` and the 3D
 * retinal cap so the optic disc, macula and lesion positions line up across
 * the 2D pane and the 3D eye.
 */
export const FUNDUS_FIELD_SCALE = 0.82
/** normalized optic-disc position for OD (nasal + slightly superior) */
export const DISC_NORM = { x: -0.42, y: -0.14 }

export function makeFundusCanvas(seed: string, opts: FundusOptions = {}): HTMLCanvasElement {
  const { size = 512, gradcam = false, eye = 'OD', hotspots = [] } = opts
  const key = `${seed}|${size}|${gradcam}|${eye}`
  const hit = cache.get(key)
  if (hit) return hit

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rnd = rng(hashSeed(seed))
  const c = size / 2

  // ---- base globe ----
  ctx.fillStyle = '#1c0a06'
  ctx.fillRect(0, 0, size, size)
  const base = ctx.createRadialGradient(c, c, size * 0.05, c, c, c)
  const hueShift = Math.floor(rnd() * 16) - 8
  base.addColorStop(0, `rgb(${190 + hueShift}, ${86 + hueShift}, ${52})`)
  base.addColorStop(0.55, `rgb(${168 + hueShift}, ${68}, ${42})`)
  base.addColorStop(0.85, `rgb(${120}, ${42}, ${28})`)
  base.addColorStop(1, '#3d150d')
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, c - 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // ---- optic disc ---- (positioned on the shared FUNDUS_FIELD_SCALE grid)
  const field = c * FUNDUS_FIELD_SCALE
  const discX = c + (eye === 'OD' ? 1 : -1) * DISC_NORM.x * field
  const discY = c + DISC_NORM.y * field
  const disc = ctx.createRadialGradient(discX, discY, 2, discX, discY, size * 0.085)
  disc.addColorStop(0, 'rgba(255,236,196,0.95)')
  disc.addColorStop(0.6, 'rgba(240,205,150,0.65)')
  disc.addColorStop(1, 'rgba(210,150,90,0)')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(discX, discY, size * 0.085, 0, Math.PI * 2)
  ctx.fill()

  // ---- vasculature: recursive branching from the disc along 4 arcades ----
  ctx.lineCap = 'round'
  const drawVessel = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || len < 6) return
    const segs = 8
    let px = x
    let py = y
    let a = angle
    ctx.beginPath()
    ctx.moveTo(px, py)
    for (let i = 0; i < segs; i++) {
      a += (rnd() - 0.5) * 0.5
      px += Math.cos(a) * (len / segs)
      py += Math.sin(a) * (len / segs)
      ctx.lineTo(px, py)
    }
    // deeper vessels darker + a touch of arterial highlight down the centre
    ctx.strokeStyle = `rgba(${86 + rnd() * 24}, ${18}, ${14}, ${0.7 + depth * 0.06})`
    ctx.lineWidth = width
    ctx.stroke()
    ctx.strokeStyle = `rgba(${180}, ${70}, ${54}, 0.28)`
    ctx.lineWidth = Math.max(0.5, width * 0.35)
    ctx.stroke()
    const branches = 1 + (rnd() > 0.4 ? 1 : 0)
    for (let b = 0; b < branches; b++) {
      drawVessel(px, py, a + (rnd() - 0.5) * 1.1, len * (0.64 + rnd() * 0.2), width * 0.7, depth - 1)
    }
  }
  const arcadeDir = eye === 'OD' ? 1 : -1
  for (const base0 of [-0.62, 0.62, -0.16, 0.16, -1.0, 1.0]) {
    drawVessel(discX, discY, base0 + (arcadeDir > 0 ? 0 : Math.PI), size * 0.34, size * 0.016, 5)
  }

  // ---- macula darkening at centre ----
  const mac = ctx.createRadialGradient(c, c, 2, c, c, size * 0.12)
  mac.addColorStop(0, 'rgba(60,18,12,0.55)')
  mac.addColorStop(1, 'rgba(60,18,12,0)')
  ctx.fillStyle = mac
  ctx.beginPath()
  ctx.arc(c, c, size * 0.12, 0, Math.PI * 2)
  ctx.fill()

  // ---- fibre-layer speckle ----
  for (let i = 0; i < 1400; i++) {
    const a = rnd() * Math.PI * 2
    const r = rnd() * (c - 4)
    ctx.fillStyle = `rgba(255,220,180,${rnd() * 0.05})`
    ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.4, 1.4)
  }

  // ---- gradcam wash ----
  if (gradcam) {
    ctx.globalCompositeOperation = 'lighter'
    const spots = hotspots.length ? hotspots : [{ x: 0.2, y: -0.1, size: 1 }, { x: -0.3, y: 0.25, size: 0.8 }]
    for (const s of spots) {
      const hx = c + s.x * (c * 0.82)
      const hy = c + s.y * (c * 0.82)
      const rad = size * (0.12 + s.size * 0.1)
      const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, rad)
      g.addColorStop(0, 'rgba(255,64,32,0.55)')
      g.addColorStop(0.5, 'rgba(255,170,0,0.28)')
      g.addColorStop(1, 'rgba(255,170,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(hx, hy, rad, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  // ---- vignette ----
  const vig = ctx.createRadialGradient(c, c, c * 0.55, c, c, c)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, size, size)
  ctx.restore()

  cache.set(key, canvas)
  return canvas
}
