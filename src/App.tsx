import StyleGuide from './StyleGuide'

export default function App() {
  if (location.hash === '#/styleguide') return <StyleGuide />
  return (
    <main style={{ padding: 32 }}>
      <h1>ThreatLens</h1>
      <p>AI 서비스 구조를 그리면 공격 경로를 찾아 줍니다.</p>
    </main>
  )
}
