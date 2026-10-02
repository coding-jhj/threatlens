import { useEffect, useState } from 'react'
import { AppNav, Brand } from './AppNav'
import EditorPage from './editor/EditorPage'
import RuleLibrary from './library/RuleLibrary'
import { routeFromHash } from './route'
import StyleGuide from './StyleGuide'

export default function App() {
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
        <EditorPage nav={<AppNav route={route} />} />
      </div>
      {route === 'rules' && (
        <div className="tl-app">
          <header className="tl-header">
            <Brand />
            <AppNav route={route} />
          </header>
          <RuleLibrary />
        </div>
      )}
    </>
  )
}
