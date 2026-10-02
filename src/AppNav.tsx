import type { Route } from './route'
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
    </nav>
  )
}

export function Brand() {
  return (
    <div className="tl-logo">
      <span className="tl-logo__mark">
        <Icon name="shield" size={18} />
      </span>
      ThreatLens
    </div>
  )
}
