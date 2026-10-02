import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (RO as never)

test('편집기 첫 화면: 제목, 부품 목록, 빈 캔버스 안내', () => {
  render(<App />)
  expect(screen.getByText('ThreatLens')).toBeTruthy()
  expect(screen.getByRole('complementary', { name: '부품 목록' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '업로드 문서 추가' })).toBeTruthy()
  expect(screen.getByText('부품을 끌어다 놓아 보세요')).toBeTruthy()
})
