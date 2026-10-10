import { jsPDF } from 'jspdf'
import type { WorkflowPatient } from '../context/WorkflowContext'
import { fetchVisitAssetUrl } from '../api/realApi'

/**
 * Client-side report generation -- matches this project's documented
 * design (documents/API_ROUTES.md: "Report generation is client-side
 * only... no report-generation endpoint"). Text comes from the doctor's
 * finalized evaluation; the imaging strip embeds the real fundus photos
 * and Grad-CAM heatmaps fetched (authenticated) from the visit's assets.
 */

const doctorName = (patient: WorkflowPatient) => patient.doctorReview?.finalizedBy ?? 'Your doctor'
const DOCTOR_TITLE = 'Retinal Specialist'

export function reportFileName(patient: WorkflowPatient) {
  return `Retinex-Report-${patient.code}.pdf`
}

export function buildReportSummaryText(patient: WorkflowPatient): string {
  const review = patient.doctorReview
  return [
    'Retinex Eye Report Summary',
    '',
    `Patient: ${patient.name} (${patient.code})`,
    `Date: ${new Date().toLocaleDateString()}`,
    `AI Classification: ${patient.aiGrade ?? 'Pending'}`,
    `Doctor: ${doctorName(patient)}`,
    '',
    `Findings: ${review?.notes ?? 'No notes available.'}`,
    `Medication: ${review?.prescription ?? 'N/A'}`,
    `Diet: ${review?.diet ?? 'N/A'}`,
  ].join('\n')
}

// ---------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------

export interface ReportImage {
  label: string
  dataUrl: string
  width: number
  height: number
}

const MAX_IMAGE_PX = 640

/** Blob URL -> downscaled JPEG data URL (fundus originals can be many MB; the PDF only needs ~640px). */
async function toDownscaledJpeg(blobUrl: string): Promise<Omit<ReportImage, 'label'> | null> {
  try {
    const img = new Image()
    img.src = blobUrl
    await img.decode()
    const scale = Math.min(1, MAX_IMAGE_PX / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width, height }
  } catch {
    return null
  }
}

/**
 * Original fundus + Grad-CAM overlay for each eye that has a result, in
 * the order right eye (OD) then left eye (OS). Anything that can't be
 * fetched (e.g. no heatmap for a rejected image) is simply skipped.
 */
export async function loadReportImages(patient: WorkflowPatient, token: string | null): Promise<ReportImage[]> {
  const visit = patient.visit
  if (!visit || !token) return []

  const wanted: { eye: 'od' | 'os'; asset: 'original' | 'gradcam_overlay'; label: string }[] = []
  if (visit.has_od || visit.od) {
    wanted.push({ eye: 'od', asset: 'original', label: 'Right eye - fundus' })
    wanted.push({ eye: 'od', asset: 'gradcam_overlay', label: 'Right eye - Grad-CAM' })
  }
  if (visit.has_os || visit.os) {
    wanted.push({ eye: 'os', asset: 'original', label: 'Left eye - fundus' })
    wanted.push({ eye: 'os', asset: 'gradcam_overlay', label: 'Left eye - Grad-CAM' })
  }

  const loaded = await Promise.all(
    wanted.map(async (w) => {
      const url = await fetchVisitAssetUrl(visit.visit_id, w.eye, w.asset, token)
      if (!url) return null
      try {
        const out = await toDownscaledJpeg(url)
        return out ? ({ label: w.label, ...out } as ReportImage) : null
      } finally {
        URL.revokeObjectURL(url)
      }
    }),
  )
  return loaded.filter((x): x is ReportImage => x !== null)
}

// ---------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------

function buildReportDoc(patient: WorkflowPatient, images: ReportImage[]): jsPDF {
  const review = patient.doctorReview
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  const bottomLimit = pageHeight - 64

  // Header band
  doc.setFillColor(20, 30, 55)
  doc.rect(0, 0, pageWidth, 96, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('Retinex', margin, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('AI-Assisted Diabetic Retinopathy Screening Report', margin, 64)
  doc.setFontSize(9)
  doc.setTextColor(180, 190, 220)
  doc.text(`Generated ${new Date().toLocaleString()}`, margin, 82)

  let y = 132

  // Patient info block
  doc.setTextColor(20, 20, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(patient.name, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 95, 110)
  doc.text(`Patient ID: ${patient.code}   |   Age: ${patient.age}`, margin, y + 16)
  y += 44

  // Classification pill: the doctor's final grade when they signed off
  const grade = review?.finalGrade ?? patient.aiGrade ?? 'Pending'
  doc.setFillColor(236, 240, 255)
  doc.roundedRect(margin, y - 14, contentWidth, 34, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(40, 50, 120)
  doc.text(`Classification: ${grade}`, margin + 12, y + 7)
  y += 48

  // Imaging strip: real fundus photos + Grad-CAM heatmaps
  if (images.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(20, 20, 30)
    doc.text('Imaging', margin, y)
    y += 14

    const gap = 12
    const tile = Math.min(120, (contentWidth - gap * (images.length - 1)) / images.length)
    const rowWidth = tile * images.length + gap * (images.length - 1)
    let x = margin + (contentWidth - rowWidth) / 2

    images.forEach((img) => {
      // fit inside the square tile, keeping the picture's aspect ratio
      const s = Math.min(tile / img.width, tile / img.height)
      const w = img.width * s
      const h = img.height * s
      doc.setFillColor(0, 0, 0)
      doc.roundedRect(x, y, tile, tile, 4, 4, 'F')
      doc.addImage(img.dataUrl, 'JPEG', x + (tile - w) / 2, y + (tile - h) / 2, w, h)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 95, 110)
      doc.text(img.label, x + tile / 2, y + tile + 12, { align: 'center' })
      x += tile + gap
    })
    y += tile + 36
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage()
      y = margin
    }
  }

  const section = (title: string, body: string) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(body || 'N/A', contentWidth) as string[]
    ensureSpace(16 + lines.length * 14 + 20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(20, 20, 30)
    doc.text(title, margin, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60, 65, 80)
    doc.text(lines, margin, y)
    y += lines.length * 14 + 20
  }

  section('Clinical Notes', review?.notes || 'No notes available.')
  section('Prescription', review?.prescription || 'N/A')
  section('Dietary Recommendations', review?.diet || 'N/A')

  // Signature block
  ensureSpace(70)
  y += 10
  doc.setDrawColor(210, 210, 220)
  doc.line(margin, y, margin + 200, y)
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 30)
  doc.text(doctorName(patient), margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 125, 140)
  doc.text(DOCTOR_TITLE, margin, y + 13)
  if (review?.finalizedAt) {
    doc.text(`Signed ${new Date(review.finalizedAt).toLocaleDateString()}`, margin, y + 26)
  }

  // Footer disclaimer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 160)
    doc.text(
      'Generated by the Retinex AI-assisted screening platform and reviewed/finalized by a licensed physician.',
      margin,
      pageHeight - 32,
    )
    if (pages > 1) doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 32, { align: 'right' })
  }

  return doc
}

async function buildDoc(patient: WorkflowPatient, token: string | null) {
  return buildReportDoc(patient, await loadReportImages(patient, token))
}

export async function downloadPatientReportPdf(patient: WorkflowPatient, token: string | null) {
  ;(await buildDoc(patient, token)).save(reportFileName(patient))
}

export async function getReportPdfBlob(patient: WorkflowPatient, token: string | null): Promise<Blob> {
  return (await buildDoc(patient, token)).output('blob')
}

export async function getReportPdfFile(patient: WorkflowPatient, token: string | null): Promise<File> {
  return new File([await getReportPdfBlob(patient, token)], reportFileName(patient), { type: 'application/pdf' })
}

/** Opens the report in a new tab (browser's native PDF viewer), no download prompt. */
export async function openPatientReportPdf(patient: WorkflowPatient, token: string | null) {
  // Open the tab synchronously (inside the click) so popup blockers allow
  // it, then point it at the PDF once the images have been fetched.
  const tab = window.open('', '_blank')
  try {
    const url = URL.createObjectURL(await getReportPdfBlob(patient, token))
    if (tab) tab.location.href = url
    else window.open(url, '_blank')
    // Revoke once the tab has had time to load it, rather than immediately.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    tab?.close()
    throw e
  }
}
