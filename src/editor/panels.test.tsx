import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RULES } from '../data'
import { analyze } from '../domain/analyze'
import { Inspector } from './Inspector'
import type { EditorNode } from './model'
import { scoreTone } from './scoreTone'
import { Summary } from './Summary'

const node = (attributes: EditorNode['attributes']): EditorNode => ({ id: 'n1', partId: 'ai_agent', attributes, x: 0, y: 0 })

test('Inspector: 속성 12개가 모두 체크박스로 나온다', () => {
  render(<Inspector node={node([])} others={[]} onConnect={() => {}} onChange={() => {}} />)
  expect(screen.getAllByRole('checkbox')).toHaveLength(12)
})

test('Inspector: 현재 속성이 체크되어 있다', () => {
  render(<Inspector node={node(['tool.exec'])} others={[]} onConnect={() => {}} onChange={() => {}} />)
  expect((screen.getByRole('checkbox', { name: /코드·명령을 실행/ }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('checkbox', { name: /믿을 수 없는 입력을 읽음/ }) as HTMLInputElement).checked).toBe(false)
})

test('Inspector: 체크하면 정의 순서대로 정렬된 속성 목록으로 onChange', () => {
  const fn = vi.fn()
  render(<Inspector node={node(['tool.exec'])} others={[]} onConnect={() => {}} onChange={fn} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /믿을 수 없는 입력을 읽음/ }))
  expect(fn).toHaveBeenCalledWith(['input.untrusted', 'tool.exec'])
})

test('Inspector: 체크를 풀면 해당 속성만 빠진다', () => {
  const fn = vi.fn()
  render(<Inspector node={node(['input.untrusted', 'tool.exec'])} others={[]} onConnect={() => {}} onChange={fn} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /코드·명령을 실행/ }))
  expect(fn).toHaveBeenCalledWith(['input.untrusted'])
})

test('Inspector: 대응 속성에는 "대응" 표시', () => {
  render(<Inspector node={node([])} others={[]} onConnect={() => {}} onChange={() => {}} />)
  expect(screen.getAllByText('대응')).toHaveLength(2)
})

test('Summary: AI 부품이 없으면 안내와 – 표시', () => {
  render(<Summary score={0} analysis={{ findings: [], paths: [] }} hasAi={false} />)
  expect(screen.getByText('AI 부품을 놓으면 분석이 시작됩니다')).toBeTruthy()
  expect(screen.getByText('–')).toBeTruthy()
})

test('Summary: 심각도별 개수와 점수 표시', () => {
  const graph = {
    nodes: [
      { id: 'a', partId: 'ai_agent', attributes: [] as never[] },
      { id: 'x', partId: 'user', attributes: ['tool.exec', 'input.untrusted'] as never[] },
    ],
    edges: [{ id: 'e', from: 'x', to: 'a' }],
  }
  const a = analyze(graph, RULES)
  const high = a.findings.filter((f) => f.severity === 'high').length
  render(<Summary score={42} analysis={a} hasAi />)
  expect(screen.getByText(`높음 ${high}`)).toBeTruthy()
  expect(screen.getByLabelText('위험 점수 42')).toBeTruthy()
})

test('scoreTone: 구간별 색', () => {
  expect(scoreTone(80)).toBe('var(--red)')
  expect(scoreTone(45)).toBe('var(--amber)')
  expect(scoreTone(10)).toBe('var(--green)')
})
