import { useState, useRef, useEffect } from 'react'
import { Eye, Layers, ZoomIn, ZoomOut, RotateCcw, Sparkles } from 'lucide-react'
import type { RealResult } from '../api/realApi'

export type FundusLayer = 'overlay' | 'original' | 'vessels' | 'lesions'

interface Props {
  result: RealResult
  originalUrl?: string | null
  overlayUrl?: string | null
  vesselUrl?: string | null
  lesionUrls?: Partial<Record<string, string | null>>
  selectedLesionKey?: string | null
  /** 'light' (default) for the light pages; 'dark' for the staff dark theme. */
  tone?: 'light' | 'dark'
}

export default function RealFundus({
  result,
  originalUrl,
  overlayUrl,
  vesselUrl,
  lesionUrls,
  selectedLesionKey,
  tone = 'light',
}: Props) {
  const dark = tone === 'dark'
  // Class sets that differ between the light and dark themes.
  const C = {
    bar: dark ? 'border-white/10 bg-white/5' : 'border-black/[0.06] bg-black/[0.03]',
    group: dark ? 'bg-white/5 border-white/10' : 'bg-white border-black/[0.06]',
    on: dark ? 'bg-emerald-500 text-white' : 'bg-[#6B8F71] text-white',
    off: dark ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-[#8A8580] hover:text-[#2B2B28] hover:bg-black/[0.02]',
    divider: dark ? 'bg-white/15' : 'bg-black/[0.12]',
    mkOn: dark ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-[#6B8F71]/40 bg-[#6B8F71]/10 text-[#6B8F71]',
    mkOff: dark ? 'border-white/10 bg-white/5 text-white/60 hover:text-white' : 'border-black/[0.06] bg-white text-[#8A8580] hover:text-[#2B2B28]',
    box: dark ? 'border-white/10 bg-white/5' : 'border-black/[0.06] bg-white',
    ico: dark ? 'text-white/60 hover:text-white' : 'text-[#8A8580] hover:text-[#2B2B28]',
    sep: dark ? 'border-white/10' : 'border-black/[0.06]',
    num: dark ? 'text-white' : 'text-[#2B2B28]',
    stage: dark ? 'border-white/10' : 'border-black/[0.06]',
  }
  const [activeLayer, setActiveLayer] = useState<FundusLayer>('overlay')
  const [showMarkers, setShowMarkers] = useState(true)
  const [zoom, setZoom] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Switch to lesions layer when a lesion channel is explicitly clicked
  useEffect(() => {
    if (selectedLesionKey) {
      setActiveLayer('lesions')
    }
  }, [selectedLesionKey])

  const crop = result.grad_cam?.crop_region

  const getMarkerPct = (x: number, y: number) => {
    if (!crop) return null
    let left: number
    let top: number

    if (activeLayer === 'original' && crop.original_width && crop.original_height) {
      left = (x / crop.original_width) * 100
      top = (y / crop.original_height) * 100
    } else if (crop.side && crop.side > 0) {
      left = ((x - crop.left) / crop.side) * 100
      top = ((y - crop.top) / crop.side) * 100
    } else {
      return null
    }

    if (left < 0 || left > 100 || top < 0 || top > 100) return null
    return { left, top }
  }

  interface MarkerItem {
    id: 'optic_disc' | 'fovea'
    x: number
    y: number
    label: string
    color: string
  }

  const activeMarkers: MarkerItem[] = []

  // Only render marker if location is explicitly present and numeric
  if (
    result.optic_disc?.location &&
    typeof result.optic_disc.location.x === 'number' &&
    typeof result.optic_disc.location.y === 'number' &&
    !isNaN(result.optic_disc.location.x) &&
    !isNaN(result.optic_disc.location.y)
  ) {
    activeMarkers.push({
      id: 'optic_disc',
      x: result.optic_disc.location.x,
      y: result.optic_disc.location.y,
      label: 'Optic Disc',
      color: '#FFFFFF',
    })
  }

  if (
    result.fovea?.location &&
    typeof result.fovea.location.x === 'number' &&
    typeof result.fovea.location.y === 'number' &&
    !isNaN(result.fovea.location.x) &&
    !isNaN(result.fovea.location.y)
  ) {
    activeMarkers.push({
      id: 'fovea',
      x: result.fovea.location.x,
      y: result.fovea.location.y,
      label: 'Fovea',
      color: '#F59E0B',
    })
  }

  const positionedMarkers = activeMarkers
    .map((m) => {
      const pos = getMarkerPct(m.x, m.y)
      return pos ? { ...m, pos } : null
    })
    .filter((m): m is MarkerItem & { pos: { left: number; top: number } } => m !== null)

  const getLabelClasses = (
    current: { left: number; top: number; id: string },
    other?: { left: number; top: number; id: string },
  ) => {
    const isNearRightEdge = current.left > 75
    const isNearLeftEdge = current.left < 25
    const isNearTopEdge = current.top < 20
    const isNearBottomEdge = current.top > 80

    if (other) {
      const dx = current.left - other.left
      const dy = current.top - other.top
      const dist = Math.hypot(dx, dy)

      // When markers are close together, separate them vertically to avoid colliding
      if (dist < 22) {
        if (current.top <= other.top) {
          // Current is above other: place label ABOVE marker
          const hAlign = isNearRightEdge
            ? 'right-0'
            : isNearLeftEdge
              ? 'left-0'
              : 'left-1/2 -translate-x-1/2'
          return `bottom-5 ${hAlign}`
        } else {
          // Current is below other: place label BELOW marker
          const hAlign = isNearRightEdge
            ? 'right-0'
            : isNearLeftEdge
              ? 'left-0'
              : 'left-1/2 -translate-x-1/2'
          return `top-5 ${hAlign}`
        }
      }
    }

    // When well separated, choose best side avoiding container boundaries
    if (isNearRightEdge) {
      return 'right-5 top-1/2 -translate-y-1/2'
    }
    if (isNearLeftEdge) {
      return 'left-5 top-1/2 -translate-y-1/2'
    }
    if (isNearTopEdge) {
      return 'top-5 left-1/2 -translate-x-1/2'
    }
    if (isNearBottomEdge) {
      return 'bottom-5 left-1/2 -translate-x-1/2'
    }

    return 'left-5 top-1/2 -translate-y-1/2'
  }

  // Determine which image URL to show
  let currentImageUrl: string | null = overlayUrl ?? null
  if (activeLayer === 'original') {
    currentImageUrl = originalUrl ?? overlayUrl ?? null
  } else if (activeLayer === 'vessels') {
    currentImageUrl = vesselUrl ?? overlayUrl ?? null
  } else if (activeLayer === 'lesions') {
    const specificLesionUrl = selectedLesionKey ? lesionUrls?.[selectedLesionKey] : null
    currentImageUrl =
      specificLesionUrl ??
      lesionUrls?.['hard_exudates'] ??
      lesionUrls?.['haemorrhages'] ??
      overlayUrl ??
      null
  }

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.3, 3))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.3, 1))
  const handleResetZoom = () => setZoom(1)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Precision Controls Toolbar as Compact Cohesive Bar */}
      <div className={`flex flex-wrap items-center gap-2 rounded-[10px] border ${C.bar} p-1.5`}>
        {/* Layer Selection Segmented Buttons */}
        <div className={`flex flex-wrap items-center gap-0.5 p-0.5 rounded-[8px] border ${C.group}`}>
          <button
            type="button"
            onClick={() => setActiveLayer('overlay')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-all duration-150 ${
              activeLayer === 'overlay'
                ? C.on
                : C.off
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Heatmap
          </button>

          <button
            type="button"
            onClick={() => setActiveLayer('original')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-all duration-150 ${
              activeLayer === 'original'
                ? C.on
                : C.off
            }`}
          >
            <Eye className="h-3 w-3" />
            Raw Fundus
          </button>

          {vesselUrl && (
            <button
              type="button"
              onClick={() => setActiveLayer('vessels')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-all duration-150 ${
                activeLayer === 'vessels'
                  ? C.on
                : C.off
            }`}
            >
              <Layers className="h-3 w-3" />
              Vessel Map
            </button>
          )}

          {lesionUrls && Object.keys(lesionUrls).length > 0 && (
            <button
              type="button"
              onClick={() => setActiveLayer('lesions')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-all duration-150 ${
                activeLayer === 'lesions'
                  ? C.on
                  : C.off
              }`}
            >
              <Layers className="h-3 w-3" />
              Lesions
            </button>
          )}
        </div>

        <div className={`h-4 w-px mx-0.5 hidden sm:block ${C.divider}`} />

        {/* Anatomical Markers Toggle & Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowMarkers((m) => !m)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-[8px] border transition-all duration-150 ${
              showMarkers
                ? C.mkOn
                : C.mkOff
            }`}
          >
            Markers: {showMarkers ? 'ON' : 'OFF'}
          </button>

          <div className={`flex items-center rounded-[8px] border ${C.box}`}>
            <button
              type="button"
              onClick={handleZoomOut}
              className={`p-1 transition-colors border-r ${C.ico} ${C.sep}`}
              title="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className={`px-2 font-mono text-xs font-semibold ${C.num}`}>
              {zoom.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className={`p-1 transition-colors border-l ${C.ico} ${C.sep}`}
              title="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          {zoom !== 1 && (
            <button
              type="button"
              onClick={handleResetZoom}
              className={`p-1 rounded-[8px] border ${C.ico} ${C.box}`}
              title="Reset zoom"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Optical Imaging Stage: snug container with photo filling edge-to-edge */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-[16px] border ${C.stage} bg-black flex items-center justify-center h-[460px] w-full max-w-[560px] mx-auto shadow-card`}
      >
        {currentImageUrl ? (
          <div
            className="relative h-full flex items-center justify-center transition-transform duration-150 ease-out"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* The wrapper that hugs the image exactly so marker percentages match image coordinates */}
            <div className="relative inline-flex items-center justify-center h-full max-w-full">
              <img
                src={currentImageUrl}
                alt="Retinal Fundus Scanned View"
                className="h-full w-auto max-w-full object-contain block rounded-[10px] select-none"
              />

              {/* Optic Disc & Fovea Marker Reticles */}
              {showMarkers &&
                positionedMarkers.map((m) => {
                  const other = positionedMarkers.find((o) => o.id !== m.id)
                  const labelClass = getLabelClasses(
                    { left: m.pos.left, top: m.pos.top, id: m.id },
                    other ? { left: other.pos.left, top: other.pos.top, id: other.id } : undefined,
                  )

                  return (
                    <div
                      key={m.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${m.pos.left}%`, top: `${m.pos.top}%` }}
                    >
                      <div
                        className="h-4 w-4 rounded-full border-2 border-dashed animate-pulse"
                        style={{ borderColor: m.color }}
                      />
                      <span
                        className={`absolute whitespace-nowrap font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/85 text-white border border-white/20 ${labelClass}`}
                      >
                        {m.label}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        ) : (
          <div className="text-center font-mono text-xs text-[#8A8580]/70 p-8">
            Fundus scan unavailable.
          </div>
        )}

        {/* Zoom Indicator when zoomed */}
        {zoom !== 1 && (
          <div className="absolute bottom-3 left-3 pointer-events-none font-mono text-[11px] text-white/90 bg-black/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/10">
            Zoom: {zoom.toFixed(1)}x
          </div>
        )}
      </div>
    </div>
  )
}
