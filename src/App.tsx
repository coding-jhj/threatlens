import { useEffect, useState } from 'react'
import { AppNav, Brand } from './AppNav'
import EditorPage from './editor/EditorPage'
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

  if (route === 'styleguide') return <StyleGuide />
  return (
    <>
      {/* 화면을 오가도 그리던 구조가 사라지지 않도록 편집기는 숨기기만 한다 */}
      <div style={{ display: route === 'editor' ? 'contents' : 'none' }}>
        <EditorPage nav={<AppNav route={route} />} ws={ws} />
      </div>
      {(route === 'rules' || route === 'report') && (
        <div className="tl-app">
          <header className="tl-header">
            <Brand />
            <AppNav route={route} />
          </header>
          {route === 'rules' ? <RuleLibrary /> : <ReportPage ws={ws} />}
        </div>
      )}
    </>
  )
}
