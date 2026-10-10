import { useWorkflow } from '../../context/WorkflowContext';

const languages = ['English', 'Hindi'];

/**
 * Shared across every patient-portal page (Home, Scans, Prescriptions)
 * via WorkflowContext so the choice persists across navigation instead
 * of resetting per page. Selecting a language doesn't translate any
 * content yet -- there's no i18n/string-translation layer wired up -- it
 * only remembers the choice; this is the control point that layer would
 * hook into once it exists.
 */
export default function LanguageSelect() {
  const { language, setLanguage } = useWorkflow();

  return (
    <div className="flex items-center gap-3 self-start sm:self-center">
      <span className="text-sky-200/70 text-xs font-medium whitespace-nowrap hidden sm:block">Language:</span>
      <select
        value={language}
        onChange={e => setLanguage(e.target.value)}
        className="bg-white/15 backdrop-blur border border-white/25 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/50 transition-all cursor-pointer appearance-none pr-8 bg-no-repeat"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center' }}
      >
        {languages.map(l => <option key={l} value={l} className="bg-sky-900 text-white">{l}</option>)}
      </select>
    </div>
  );
}
