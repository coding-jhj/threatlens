import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { appliedKey } from '../domain/engine'
import { SAMPLES } from '../samples/samples'
import { AUTOSAVE_KEY, loadAutosave, saveAutosave } from './storage'
import { MAX_NODES, parseSaved, parseShareHash, serialize, shareHash } from './serialize'

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (RO as never)

const graph = SAMPLES.find((s) => s.id === 'mail-assistant')!.graph
const applied = new Set([appliedKey('n2', 'R-01', 'human_approval')])

beforeEach(() => {
  localStorage.setItem('threatlens.onboarded.v1', '1')
  location.hash = ''
})
afterEach(() => {
  vi.restoreAllMocks()
  location.hash = ''
})

test('serialize → parseSaved: 구조와 적용한 대응이 그대로 돌아온다', () => {
  const r = parseSaved(serialize(graph, applied))
  expect(r.ok).toBe(true)
  if (r.ok) {
    expect(r.graph).toEqual(graph)
    expect(r.applied).toEqual([...applied])
  }
})

test('serialize(pretty): 사람이 읽을 수 있게 줄바꿈된다', () => {
  expect(serialize(graph, applied, true)).toContain('\n  "nodes"')
})

const bad = (mut: (o: Record<string, unknown>) => void) => {
  const o = JSON.parse(serialize(graph, applied)) as Record<string, unknown>
  mut(o)
  return parseSaved(JSON.stringify(o))
}
const errOf = (r: ReturnType<typeof parseSaved>) => (r.ok ? '' : r.error)

test('parseSaved: 깨진 입력마다 한국어 이유를 돌려준다', () => {
  expect(errOf(parseSaved('not json'))).toMatch(/JSON 형식/)
  expect(errOf(parseSaved('[]'))).toMatch(/객체/)
  expect(errOf(bad((o) => (o.version = 2)))).toMatch(/버전/)
  expect(errOf(bad((o) => (o.nodes = 'x')))).toMatch(/배열/)
  expect(errOf(bad((o) => ((o.nodes as { part: string }[])[0].part = 'zzz')))).toMatch(/알 수 없는 부품/)
  expect(errOf(bad((o) => ((o.nodes as { attributes: string[] }[])[0].attributes = ['nope'])))).toMatch(/알 수 없는 속성/)
  expect(errOf(bad((o) => ((o.nodes as { x: unknown }[])[0].x = 'a')))).toMatch(/위치/)
  expect(errOf(bad((o) => ((o.nodes as { id: string }[])[1].id = (o.nodes as { id: string }[])[0].id)))).toMatch(/중복/)
  expect(errOf(bad((o) => ((o.edges as { to: string }[])[0].to = 'ghost')))).toMatch(/없는 부품/)
  expect(errOf(bad((o) => ((o.edges as { to: string; from: string }[])[0].to = (o.edges as { from: string }[])[0].from)))).toMatch(/같은 부품끼리/)
  expect(errOf(bad((o) => (o.edges as unknown[]).push({ ...(o.edges as object[])[0], id: 'e99' })))).toMatch(/중복/)
})

test('parseSaved: 크기 제한', () => {
  const many = Array.from({ length: MAX_NODES + 1 }, (_, i) => ({ id: `n${i}`, part: 'user', attributes: [], x: 0, y: 0 }))
  expect(errOf(parseSaved(JSON.stringify({ version: 1, nodes: many, edges: [] })))).toMatch(/너무 많습니다/)
  expect(errOf(parseSaved('x'.repeat(200_001)))).toMatch(/너무 큽니다/)
})

test('parseSaved: 없는 부품에 걸린 대응 체크는 버린다', () => {
  const r = bad((o) => (o.applied = ['ghost|R-01|human_approval', ...(o.applied as string[])]))
  expect(r.ok && r.applied).toEqual([...applied])
})

test('공유 링크: 해시로 만들고 다시 읽으면 같다. 접두어가 다르면 null, 깨진 링크는 오류', () => {
  const h = shareHash(graph, applied)
  expect(h.startsWith('#/s/')).toBe(true)
  expect(h.slice(4)).not.toMatch(/[+/=]/)
  const r = parseShareHash(h)
  expect(r && r.ok && r.graph).toEqual(graph)
  expect(parseShareHash('#/rules')).toBeNull()
  const broken = parseShareHash('#/s/@@@')
  expect(broken && !broken.ok).toBe(true)
  const half = parseShareHash(h.slice(0, 40))
  expect(half && !half.ok).toBe(true)
})

test('자동 저장: 저장하고 읽고, 깨진 값은 무시한다', () => {
  saveAutosave(graph, applied)
  expect(loadAutosave()?.graph).toEqual(graph)
  localStorage.setItem(AUTOSAVE_KEY, '{broken')
  expect(loadAutosave()).toBeNull()
})

test('앱: 구조를 불러오면 자동 저장되고, 다시 열면 그대로 복원된다', async () => {
  const first = render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /메일 비서/ }))
  await waitFor(() => expect(loadAutosave()?.graph.nodes).toHaveLength(5))
  first.unmount()
  render(<App />)
  expect(screen.getByLabelText('위험 점수 51')).toBeTruthy()
})

test('앱: 공유 링크로 열면 그 구조가 보이고 주소창에서 링크가 사라진다', () => {
  history.replaceState(null, '', shareHash(graph, new Set()))
  render(<App />)
  expect(screen.getByLabelText('위험 점수 51')).toBeTruthy()
  expect(screen.getByText('공유 링크의 구조를 불러왔습니다.')).toBeTruthy()
  expect(location.hash).toBe('#/')
})

test('앱: 깨진 공유 링크는 이유를 알려주고 빈 화면으로 시작한다', () => {
  history.replaceState(null, '', '#/s/@@@')
  render(<App />)
  expect(screen.getByRole('status').textContent).toMatch(/공유 링크를 열 수 없습니다/)
  expect(screen.getByText('부품을 끌어다 놓아 보세요')).toBeTruthy()
})

test('앱: 구조가 비어 있으면 공유·저장은 안내만 한다', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '공유·저장' }))
  fireEvent.click(screen.getByRole('menuitem', { name: /공유 링크 복사/ }))
  expect(screen.getByRole('status').textContent).toMatch(/공유할 구조가 없습니다/)
})

test('앱: 공유 링크 복사는 클립보드에 현재 구조의 링크를 쓴다', async () => {
  const write = vi.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText: write } })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /메일 비서/ }))
  fireEvent.click(screen.getByRole('button', { name: '공유·저장' }))
  fireEvent.click(screen.getByRole('menuitem', { name: /공유 링크 복사/ }))
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
  expect(write.mock.calls[0][0]).toContain('#/s/')
  expect(await screen.findByText(/공유 링크를 복사했습니다/)).toBeTruthy()
})

test('앱: JSON 저장은 .json 파일을 내려받는다', () => {
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /메일 비서/ }))
  fireEvent.click(screen.getByRole('button', { name: '공유·저장' }))
  fireEvent.click(screen.getByRole('menuitem', { name: /JSON 파일로 저장/ }))
  expect(click).toHaveBeenCalledTimes(1)
})

test('앱: JSON 불러오기 성공/실패 안내', async () => {
  render(<App />)
  const input = screen.getByLabelText('JSON 파일 선택')
  const pick = (text: string, name = 'a.json') => fireEvent.change(input, { target: { files: [new File([text], name, { type: 'application/json' })] } })

  pick('{"version":1,"nodes":"x","edges":[]}')
  expect((await screen.findByRole('status')).textContent).toMatch(/불러올 수 없습니다: nodes와 edges/)

  pick(serialize(SAMPLES[3].graph, new Set()), 'mail.json')
  expect(await screen.findByLabelText('위험 점수 51')).toBeTruthy()
  expect(await screen.findByText(/"mail.json"을 불러왔습니다/)).toBeTruthy()
})
