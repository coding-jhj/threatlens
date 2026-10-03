import { describe, expect, test } from 'vitest'
import { SAMPLES } from '../samples/samples'
import { QUESTIONS, buildFromAnswers } from '../wizard/wizard'
import type { Graph } from './graph'
import { lintStructure } from './lint'

const g = (nodes: [string, string][], edges: [string, string][]): Graph => ({
  nodes: nodes.map(([id, partId]) => ({ id, partId, attributes: [] })),
  edges: edges.map(([from, to], i) => ({ id: `e${i}`, from, to })),
})
const codes = (graph: Graph) => lintStructure(graph).map((w) => w.code).sort()

describe('구조 점검', () => {
  test('이어지지 않은 부품: 양성은 경고, 음성(부품 1개뿐, 모두 연결)은 없음', () => {
    expect(codes(g([['a', 'user'], ['b', 'ai_agent'], ['c', 'mail_tool']], [['a', 'b'], ['b', 'c']]))).toEqual([])
    const w = lintStructure(g([['a', 'user'], ['b', 'ai_agent'], ['c', 'mail_tool']], [['a', 'b']]))
    expect(w.filter((x) => x.code === 'isolated').map((x) => x.nodeId)).toEqual(['c'])
    expect(codes(g([['b', 'ai_agent']], []))).toEqual([])
  })

  test('입력 없는 AI: 도구만 이어진 AI는 경고, 사용자·문서·저장소가 있으면 없음', () => {
    expect(codes(g([['b', 'ai_agent'], ['c', 'mail_tool']], [['b', 'c']]))).toEqual(['ai-no-input'])
    for (const src of ['user', 'upload_doc', 'doc_store', 'sensor']) expect(codes(g([['a', src], ['b', 'ai_agent']], [['a', 'b']]))).toEqual([])
  })

  test('AI에서 닿지 않는 도구: 저장소만 거친 도구는 경고, AI 바로 옆이거나 다른 도구를 거치면 없음', () => {
    const w = lintStructure(g([['u', 'user'], ['b', 'ai_agent'], ['s', 'doc_store'], ['c', 'mail_tool']], [['u', 'b'], ['b', 's'], ['s', 'c']]))
    expect(w.map((x) => [x.code, x.nodeId])).toEqual([['tool-not-linked-to-ai', 'c']])
    expect(codes(g([['u', 'user'], ['b', 'ai_agent'], ['c', 'mail_tool']], [['u', 'b'], ['b', 'c']]))).toEqual([])
    expect(codes(g([['u', 'user'], ['b', 'ai_agent'], ['x', 'code_exec'], ['c', 'ext_api']], [['u', 'b'], ['b', 'x'], ['x', 'c']]))).toEqual([])
  })

  test('뒤집힌 화살표: 입력 부품이 도착점이면 경고, 출발점이면 없음', () => {
    const w = lintStructure(g([['d', 'upload_doc'], ['b', 'ai_agent']], [['b', 'd']]))
    expect(w.map((x) => x.code).sort()).toEqual(['edge-into-input'])
    expect(w.find((x) => x.code === 'edge-into-input')?.edgeId).toBe('e0')
    expect(codes(g([['d', 'upload_doc'], ['b', 'ai_agent']], [['d', 'b']]))).toEqual([])
  })

  test('경고마다 고유 key·제목·설명이 있다', () => {
    const w = lintStructure(g([['a', 'user'], ['b', 'ai_agent'], ['d', 'web_page'], ['c', 'mail_tool']], [['a', 'b'], ['b', 'd']]))
    expect(new Set(w.map((x) => x.key)).size).toBe(w.length)
    for (const x of w) expect(x.title && x.detail).toBeTruthy()
  })

  test('기본 예시 전부와 마법사 256개 조합은 경고가 없다', () => {
    for (const s of SAMPLES) expect(lintStructure(s.graph), s.id).toEqual([])
    for (let n = 0; n < 1 << QUESTIONS.length; n++) {
      const graph = buildFromAnswers(QUESTIONS.map((_, i) => ((n >> i) & 1) === 1))
      expect(lintStructure(graph), String(n)).toEqual([])
    }
  })
})
