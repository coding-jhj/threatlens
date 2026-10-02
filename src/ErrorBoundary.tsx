import { Component, type ReactNode } from 'react'
import { Button } from './ui/components'

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20 }}>화면을 그리다 문제가 생겼습니다</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: 14 }}>
          계산은 모두 이 브라우저 안에서만 이루어지고 어디에도 전송되지 않았습니다. 다시 시도해도 같으면 페이지를 새로고침해 주세요. 그려 둔 구조는 새로고침하면 사라집니다.
        </p>
        <Button variant="primary" onClick={() => this.setState({ failed: false })}>
          다시 시도
        </Button>{' '}
        <Button onClick={() => location.reload()}>새로고침</Button>
      </main>
    )
  }
}
