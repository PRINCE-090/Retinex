import { Vector3 } from 'three'
import type { Eye } from '../types'
import { DISC_NORM } from './fundusCanvas'

/**
 * Maps normalized fundus-image coordinates onto the 3D retinal cup so that the
 * 2D fundus pane and the 3D eye agree on where every feature sits.
 *
 * Fundus space: x,y ∈ [-1, 1], fovea at the origin, +x temporal (OD), +y
 * inferior (screen-down, matching the SVG overlay).
 * Eye space: unit sphere centred at origin, cornea toward +Z, posterior pole
 * toward -Z, +Y superior. The retina lines the posterior interior.
 */

export const EYE_RADIUS = 1
export const RETINA_RADIUS = 0.9
/** widest eccentricity a 45° fundus photo captures, in radians */
export const MAX_ECCENTRICITY = 0.92

/** unit direction from the eye centre toward a fundus coordinate */
export function fundusDirection(x: number, y: number, eye: Eye): Vector3 {
  // OS is the mirror image of OD across the vertical meridian
  const fx = eye === 'OS' ? -x : x
  const r = Math.min(1, Math.hypot(fx, y))
  const theta = r * MAX_ECCENTRICITY // angle away from the posterior pole
  const phi = Math.atan2(-y, fx) // negate: screen-down → anatomical inferior (−Y)
  return new Vector3(
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    -Math.cos(theta),
  ).normalize()
}

/** point on the retinal surface for a fundus coordinate */
export function retinaPoint(x: number, y: number, eye: Eye, inset = 0): Vector3 {
  return fundusDirection(x, y, eye).multiplyScalar(RETINA_RADIUS - inset)
}

/** optic disc — same normalized position the fundus texture draws it at */
export function opticDiscPoint(eye: Eye, inset = 0): Vector3 {
  return retinaPoint(DISC_NORM.x, DISC_NORM.y, eye, inset)
}

export const foveaPoint = (eye: Eye, inset = 0): Vector3 => retinaPoint(0, 0, eye, inset)
