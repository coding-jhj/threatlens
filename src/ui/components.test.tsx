import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Button, Chip, FixRow, SeverityChip } from './components'
import { formatDelta } from './severity'

test('formatDelta: 음수는 유니코드 마이너스', () => {
  expect(formatDelta(-30)).toBe('−30')
  expect(formatDelta(5)).toBe('+5')
})

test('SeverityChip: 한글 라벨', () => {
  render(<SeverityChip severity="high" />)
  expect(screen.getByText('높음')).toBeTruthy()
})

test('Chip: 톤 클래스', () => {
  render(<Chip tone="chem">화공 특화</Chip>)
  expect(screen.getByText('화공 특화').className).toContain('tl-chip--chem')
})

test('Button: 기본 type=button, 클릭 동작', () => {
  const fn = vi.fn()
  render(<Button onClick={fn}>실행</Button>)
  const b = screen.getByRole('button', { name: '실행' })
  expect(b.getAttribute('type')).toBe('button')
  fireEvent.click(b)
  expect(fn).toHaveBeenCalledOnce()
})

test('FixRow: 체크 토글이 onChange로 전달', () => {
  const fn = vi.fn()
  render(<FixRow label="사람 승인" score={-30} checked={false} onChange={fn} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /사람 승인/ }))
  expect(fn).toHaveBeenCalledWith(true)
})
