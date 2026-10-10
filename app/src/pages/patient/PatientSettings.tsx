import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { User, Languages, Volume2, Eye, MessageCircle, ShieldCheck, LogOut, Download, Trash2, Square } from 'lucide-react'
import { useWorkflow } from '../../context/WorkflowContext'
import { usePatientPrefs, normalisePhone, resolveVoiceLang } from '../../lib/patientPrefs'
import { SETTINGS_UI } from '../../lib/settingsStrings'
import type { Language } from '../../lib/i18n'
import { gsap, prefersReducedMotion } from '../../lib/scroll'
import { speak, speechSupported, stopSpeaking } from '../../lib/speech'

// Slow / normal / fast. Kept far apart: 0.75x and 1.25x sounded nearly the same.
const SPEEDS = [0.6, 1, 1.6]

const card = 'backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 space-y-5'
const label = 'block text-xs font-semibold text-white/70 mb-1.5'
const fieldCls =
  'w-full bg-black/20 border border-white/15 rounded-xl px-4 py-3 text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/40 transition-all'

function Section({ icon: Icon, title, desc, children }: { icon: typeof User; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className={card}>
      <div>
        <h2 className="flex items-center gap-2 text-white font-bold">
          <Icon className="h-4 w-4" /> {title}
        </h2>
        {desc && <p className="text-xs text-white/55 mt-1">{desc}</p>}
      </div>
      {children}
    </section>
  )
}

function Toggle({ checked, onChange, title, desc, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc?: string; disabled?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        {desc && <p className="text-xs text-white/55 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-emerald-400' : 'bg-white/20'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

// Same sliding white pill as the navbar / landing-page tabs.
function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const placed = useRef(false)
  const idx = options.findIndex((o) => o.v === value)

  const place = (animate: boolean) => {
    const pill = pillRef.current
    const btn = btnRefs.current[idx]
    if (!pill || !btn) return
    const props = { x: btn.offsetLeft, width: btn.offsetWidth, opacity: 1 }
    if (animate && placed.current && !prefersReducedMotion()) gsap.to(pill, { ...props, duration: 0.45, ease: 'power3.out' })
    else gsap.set(pill, props)
    placed.current = true
  }

  useLayoutEffect(() => {
    place(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // Re-measure on real size changes (e.g. language switch changes label widths).
  const placeRef = useRef(place)
  placeRef.current = place
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let first = true
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false
        return
      }
      placeRef.current(false)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={wrapRef} className="relative inline-flex flex-wrap gap-1 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
      <div ref={pillRef} className="pointer-events-none absolute inset-y-1 left-0 rounded-full bg-white opacity-0 seg-pill" />
      {options.map((o, i) => (
        <button
          key={String(o.v)}
          ref={(el) => {
            btnRefs.current[i] = el
          }}
          type="button"
          onClick={() => onChange(o.v)}
          className={`relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${value === o.v ? 'text-neutral-900 seg-active' : 'text-white/70 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function PatientSettings() {
  const { currentPatient: patient, currentPatientId, language, setLanguage, logout } = useWorkflow()
  const navigate = useNavigate()
  const { prefs, update } = usePatientPrefs(currentPatientId)
  const [testing, setTesting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState(prefs.familyPhone)

  useEffect(() => setPhoneDraft(prefs.familyPhone), [prefs.familyPhone])
  useEffect(() => () => stopSpeaking(), [])
  const [voiceMissing, setVoiceMissing] = useState(false)

  if (!currentPatientId) return <Navigate to="/login/patient" replace />
  if (!patient) return <div className="p-10 text-sky-200/70">Loading your records…</div>
  const s = SETTINGS_UI[language as Language]

  const voiceLang = resolveVoiceLang(prefs.voiceLang, language)

  // Speaks the sample with the given settings. Called by the Test button
  // and again whenever the speed / voice language changes, so picking an
  // option immediately plays it that way.
  const playSample = async (lang: string, rate: number) => {
    setTesting(true)
    const ok = await speak(s.testSentence, lang, rate, () => setTesting(false))
    setVoiceMissing(!ok)
    if (!ok) setTesting(false)
  }

  const testVoice = () => {
    if (testing) {
      stopSpeaking()
      setTesting(false)
      return
    }
    playSample(voiceLang, prefs.voiceRate)
  }

  const pickVoiceLang = (v: 'auto' | 'en-IN' | 'hi-IN') => {
    update({ voiceLang: v })
    playSample(resolveVoiceLang(v, language), prefs.voiceRate)
  }

  const pickRate = (r: number) => {
    update({ voiceRate: r })
    playSample(voiceLang, r)
  }

  const changeLanguage = (l: Language) => {
    setLanguage(l)
    update({ language: l })
  }

  const phoneOk = phoneDraft.trim() === '' || normalisePhone(phoneDraft) !== ''
  const commitPhone = () => {
    if (phoneOk) update({ familyPhone: phoneDraft.trim() })
  }

  const downloadData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), patient, settings: prefs }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Retinex-MyData-${patient.code}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // BACKEND: this should create a deletion request the clinic can see and
  // action (no such endpoint yet); for now it is only recorded in this
  // browser.
  const requestDeletion = () => {
    update({ deletionRequestedAt: new Date().toISOString() })
    setConfirmDelete(false)
  }

  const rows: [string, string][] = [
    [s.fullName, patient.name],
    [s.patientId, patient.code],
    [s.phone, patient.phone],
    [s.age, String(patient.age)],
  ]

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="pt-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">{s.title}</h1>
        <p className="text-white/60 mt-1">{s.subtitle}</p>
      </div>

      <Section icon={User} title={s.profile}>
        <dl className="grid sm:grid-cols-2 gap-4">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className={label}>{k}</dt>
              <dd className="rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section icon={Languages} title={s.languageTitle} desc={s.languageDesc}>
        <Segmented<Language>
          value={language as Language}
          onChange={changeLanguage}
          options={[
            { v: 'English', label: 'English' },
            { v: 'Hindi', label: 'हिंदी' },
          ]}
        />
      </Section>

      <Section icon={Volume2} title={s.voiceTitle} desc={s.voiceDesc}>
        <div>
          <p className={label}>{s.voiceLang}</p>
          <Segmented
            value={prefs.voiceLang}
            onChange={pickVoiceLang}
            options={[
              { v: 'auto', label: s.voiceAuto },
              { v: 'en-IN', label: s.voiceEnglish },
              { v: 'hi-IN', label: s.voiceHindi },
            ]}
          />
        </div>
        <div>
          <p className={label}>{s.speed}</p>
          <Segmented
            value={SPEEDS.reduce((a, b) => (Math.abs(b - prefs.voiceRate) < Math.abs(a - prefs.voiceRate) ? b : a))}
            onChange={pickRate}
            options={[
              { v: 0.6, label: s.slow },
              { v: 1, label: s.normal },
              { v: 1.6, label: s.fast },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={testVoice}
          disabled={!speechSupported()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-40"
        >
          {testing ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {testing ? s.stopVoice : s.testVoice}
        </button>
        {voiceMissing && <p className="text-xs text-amber-200">{s.noVoice}</p>}
      </Section>

      <Section icon={Eye} title={s.accessTitle}>
        <Toggle checked={prefs.largeText} onChange={(v) => update({ largeText: v })} title={s.largeText} desc={s.largeTextDesc} />
        <Toggle checked={prefs.highContrast} onChange={(v) => update({ highContrast: v })} title={s.contrast} desc={s.contrastDesc} />
      </Section>

      <Section icon={MessageCircle} title={s.shareTitle}>
        <Toggle checked={prefs.shareIncludePdf} onChange={(v) => update({ shareIncludePdf: v })} title={s.attachPdf} desc={s.attachPdfDesc} />
        <div>
          <label className={label}>{s.familyNumber}</label>
          <input
            className={fieldCls}
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={phoneDraft}
            onChange={(e) => setPhoneDraft(e.target.value)}
            onBlur={commitPhone}
          />
          {!phoneOk && <p className="text-xs mt-1.5 text-rose-300">{s.familyInvalid}</p>}
        </div>
        <Toggle
          checked={prefs.shareToFamily && normalisePhone(prefs.familyPhone) !== ''}
          disabled={normalisePhone(prefs.familyPhone) === ''}
          onChange={(v) => update({ shareToFamily: v })}
          title={s.familyToggle}
        />
      </Section>

      <Section icon={ShieldCheck} title={s.privacyTitle}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">{s.downloadData}</p>
            <p className="text-xs text-white/55 mt-0.5">{s.downloadDataDesc}</p>
          </div>
          <button type="button" onClick={downloadData} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors flex-shrink-0">
            <Download className="h-4 w-4" /> {s.downloadData}
          </button>
        </div>
        <Toggle checked={prefs.modelConsent} onChange={(v) => update({ modelConsent: v })} title={s.consent} desc={s.consentDesc} />

        <div className="pt-4 border-t border-white/10">
          <p className="text-sm font-medium text-white">{s.deleteTitle}</p>
          <p className="text-xs text-white/55 mt-0.5 mb-3">{s.deleteDesc}</p>
          {prefs.deletionRequestedAt ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
                {s.deletePending} {new Date(prefs.deletionRequestedAt).toLocaleDateString()}
              </span>
              <button type="button" onClick={() => update({ deletionRequestedAt: null })} className="text-sm text-white/70 hover:text-white underline underline-offset-4">
                {s.deleteWithdraw}
              </button>
            </div>
          ) : confirmDelete ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={requestDeletion} className="px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-semibold hover:bg-rose-400 transition-colors">
                {s.deleteConfirm}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20 transition-colors">
                {s.deleteCancel}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose-400/40 text-rose-300 text-sm font-medium hover:bg-rose-500/10 transition-colors">
              <Trash2 className="h-4 w-4" /> {s.deleteBtn}
            </button>
          )}
        </div>
      </Section>

      <Section icon={LogOut} title={s.sessionTitle}>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { logout(); navigate('/login/role-selection') }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-neutral-900 text-sm font-semibold hover:bg-white/90 transition-colors">
            <LogOut className="h-4 w-4" /> {s.signOut}
          </button>
        </div>
      </Section>
    </div>
  )
}
