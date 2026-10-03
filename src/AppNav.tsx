import type { Route } from './route'
import { setTheme, useTheme } from './theme'
import { Icon } from './ui/Icon'
import './library/library.css'

export function AppNav({ route }: { route: Route }) {
  const cur = (r: Route) => (route === r ? 'page' : undefined)
  return (
    <nav className="tl-nav" aria-label="화면 이동">
      <a href="#/" aria-current={cur('editor')}>
        위협 지도
      </a>
      <a href="#/rules" aria-current={cur('rules')}>
        규칙 라이브러리
      </a>
      <a href="#/report" aria-current={cur('report')}>
        보고서
      </a>
      <a href="#/eval" aria-current={cur('eval')}>
        평가표
      </a>
    </nav>
  )
}

export function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className="tl-btn tl-btn--secondary tl-theme" aria-pressed={theme === 'dark'} onClick={() => setTheme(next)}>
      {theme === 'dark' ? '밝은 화면' : '어두운 화면'}
    </button>
  )
}

export function Brand() {
  return (
    <div className="tl-logo">
      <span className="tl-logo__mark">
        <Icon name="shield" size={18} />
      </span>
      <span className="tl-logo__text">ThreatLens</span>
    </div>
  )
}
