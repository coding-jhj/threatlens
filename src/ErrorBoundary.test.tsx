import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

let boom = true
function Bomb() {
  if (boom) throw new Error('x')
  return <p>정상</p>
}

test('렌더 오류가 나면 안내를 보여주고, 다시 시도하면 복구된다', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <ErrorBoundary>
      <Bomb />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert').textContent).toContain('문제가 생겼습니다')
  boom = false
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(screen.getByText('정상')).toBeTruthy()
  vi.restoreAllMocks()
})
