import { LANGS } from '../lib/i18n.js';

export default function LangSwitch({ lang, onChange }) {
  return (
    <div className="lang">
      {Object.entries(LANGS).map(([code, label]) => (
        <button key={code} className={code === lang ? 'is-active' : ''} onClick={() => onChange(code)}>
          {label}
        </button>
      ))}
    </div>
  );
}
