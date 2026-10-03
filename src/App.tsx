import { useEffect, useRef, useState } from 'react'
import { AppNav, Brand, ThemeToggle } from './AppNav'
import EditorPage from './editor/EditorPage'
import EvalPage from './eval/EvalPage'
import RuleLibrary from './library/RuleLibrary'
import ReportPage from './report/ReportPage'
import { routeFromHash } from './route'
import { parseShareHash } from './share/serialize'
import StyleGuide from './StyleGuide'
import { useWorkspace } from './workspace'

export default function App() {
  const ws = useWorkspace()
  const { replaceAll, flash } = ws
  const [route, setRoute] = useState(() => routeFromHash(location.hash))
  const movedOnce = useRef(false)
  useEffect(() => {
    const onHash = () => {
      const shared = parseShareHash(location.hash)
      if (shared) {
        // 열려 있는 탭에 공유 링크를 붙여 넣은 경우
        if (shared.ok) {
          replaceAll(shared.graph, shared.applied)
          flash('공유 링크의 구조를 불러왔습니다.')
        } else flash(`공유 링크를 열 수 없습니다: ${shared.error}`)
        history.replaceState(null, '', `${location.pathname}${location.search}#/`)
      }
      setRoute(routeFromHash(location.hash))
    }
    // 처음 열 때 이미 읽어 들인 공유 링크는 주소창에서 지운다 (새로고침 때 자동 저장을 덮어쓰지 않도록)
    if (parseShareHash(location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#/`)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [replaceAll, flash])

  useEffect(() => {
    const TITLES: Record<string, string> = { editor: '위협 지도', rules: '규칙 라이브러리', report: '보고서', eval: '평가표' }
    document.title = `${TITLES[route] ?? 'ThreatLens'} · ThreatLens`
    // 화면을 옮기면 스크린리더가 새 화면의 제목부터 읽도록 제목으로 포커스를 보낸다 (첫 로드에는 건드리지 않는다)
    if (!movedOnce.current) {
      movedOnce.current = true
      return
    }
    requestAnimationFrame(() => {
      const h = [...document.querySelectorAll<HTMLElement>('main h1')].find((x) => x.offsetParent !== null || x.classList.contains('tl-sr'))
      if (route !== 'editor') {
        const shown = [...document.querySelectorAll<HTMLElement>('main h1')].find((x) => !x.closest('[style*="display: none"]'))
        shown?.setAttribute('tabindex', '-1')
        shown?.focus()
      } else h?.focus()
    })
  }, [route])

  if (route === 'styleguide') return <StyleGuide />
  return (
    <>
      {/* 화면을 오가도 그리던 구조가 사라지지 않도록 편집기는 숨기기만 한다 */}
      <div style={{ display: route === 'editor' ? 'contents' : 'none' }}>
        <EditorPage nav={<AppNav route={route} />} ws={ws} active={route === 'editor'} />
      </div>
      {(route === 'rules' || route === 'report' || route === 'eval') && (
        <div className="tl-app">
          <header className="tl-header">
            <Brand />
            <AppNav route={route} />
            <div style={{ flex: 1 }} />
            <ThemeToggle />
          </header>
          {route === 'rules' ? <RuleLibrary /> : route === 'eval' ? <EvalPage /> : <ReportPage ws={ws} />}
        </div>
      )}
    </>
  )
}
