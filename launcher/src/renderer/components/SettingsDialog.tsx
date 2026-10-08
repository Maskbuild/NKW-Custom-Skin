import { useLang, useT } from '../i18n'

export function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h2>{t('set.title')}</h2>
        <div className="field">
          <span className="lbl">{t('set.lang')}</span>
          <div className="seg">
            <button className={lang === 'th' ? 'on' : ''} onClick={() => setLang('th')}>ไทย</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
        <p className="muted">{t('set.theme')}</p>
        <div className="actions">
          <button className="btn primary" onClick={onClose}>{t('set.close')}</button>
        </div>
      </div>
    </div>
  )
}
