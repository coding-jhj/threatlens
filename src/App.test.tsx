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

test('내비게이션: 규칙 라이브러리로 가도 편집기는 숨겨질 뿐 사라지지 않는다', async () => {
  location.hash = '#/rules'
  render(<App />)
  expect(await screen.findByRole('heading', { name: '규칙 라이브러리' })).toBeTruthy()
  expect(document.querySelector('.tl-palette')).not.toBeNull()
  location.hash = ''
})
