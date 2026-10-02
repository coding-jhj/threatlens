import EditorPage from './editor/EditorPage'
import StyleGuide from './StyleGuide'

export default function App() {
  if (location.hash === '#/styleguide') return <StyleGuide />
  return <EditorPage />
}
