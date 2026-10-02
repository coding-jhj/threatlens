import { useEffect, useState } from 'react'
import { AppNav, Brand } from './AppNav'
import EditorPage from './editor/EditorPage'
import RuleLibrary from './library/RuleLibrary'
import ReportPage from './report/ReportPage'
import { routeFromHash } from './route'
import StyleGuide from './StyleGuide'
import { useWorkspace } from './workspace'

export default function App() {
  const ws = useWorkspace()
  const [route, setRoute] = useState(() => routeFromHash(location.hash))
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
