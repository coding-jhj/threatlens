import { fireEvent, render, screen } from '@testing-library/react'
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

test('첫 방문: 안내가 뜨고, 닫으면 다시 뜨지 않는다', () => {
  localStorage.clear()
  location.hash = ''
  const { unmount } = render(<App />)
  expect(screen.getByRole('dialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '직접 그리기' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  unmount()
  render(<App />)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('예시 불러오기: 빈 캔버스의 예시 버튼으로 구조와 점수가 나온다', () => {
  localStorage.setItem('threatlens.onboarded.v1', '1')
  location.hash = ''
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /메일 비서/ }))
  expect(screen.getByLabelText('위험 점수 55')).toBeTruthy()
  expect(screen.getByText(/발견된 위협 8개/)).toBeTruthy()
})

test('사용법 버튼으로 안내를 다시 연다', () => {
  localStorage.setItem('threatlens.onboarded.v1', '1')
  location.hash = ''
  render(<App />)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '사용법' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('평가표 화면으로 이동할 수 있다', async () => {
  localStorage.setItem('threatlens.onboarded.v1', '1')
  location.hash = '#/eval'
  render(<App />)
  expect(await screen.findByRole('heading', { name: '평가표' })).toBeTruthy()
  location.hash = ''
})
