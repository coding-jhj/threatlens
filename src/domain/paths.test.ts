import { describe, expect, test } from 'vitest'
import { RULES } from '../data'
import { analyze } from './analyze'
import { appliedKey } from './engine'
import type { Graph } from './graph'
import { MAX_PATHS, findPaths, pathEdgeIds } from './paths'

const n = (id: string, partId: string, attributes: Graph['nodes'][number]['attributes'] = []) => ({ id, partId, attributes })
const e = (from: string, to: string) => ({ id: `${from}>${to}`, from, to })

/** 시안의 예시 구조 */
const sample = (): Graph => ({
  nodes: [
    n('doc', 'upload_doc', ['input.untrusted']),
    n('sensor', 'sensor', ['input.sensor', 'input.untrusted']),
    n('staff', 'user'),
    n('ai', 'ai_agent', ['data.sensitive']),
    n('store', 'doc_store', ['data.sensitive']),
    n('mail', 'mail_tool', ['tool.send']),
    n('ext', 'external_party'),
    n('ctl', 'control_api', ['tool.write', 'link.control']),
    n('plc', 'plc'),
  ],
  edges: [e('doc', 'ai'), e('sensor', 'ai'), e('staff', 'ai'), e('store', 'ai'), e('ai', 'mail'), e('mail', 'ext'), e('ai', 'ctl'), e('ctl', 'plc')],
})

describe('findPaths', () => {
  test('시안 구조: 입력 2개 × 출구 2개 = 경로 4개, 정렬된 순서', () => {
    const paths = findPaths(sample())
    expect(paths.map((p) => p.nodeIds)).toEqual([
      ['doc', 'ai', 'mail', 'ext'],
      ['doc', 'ai', 'ctl', 'plc'],
      ['sensor', 'ai', 'mail', 'ext'],
      ['sensor', 'ai', 'ctl', 'plc'],
    ])
  })

  test('입력 속성이 없는 사용자 노드는 출발점이 아니다', () => {
    const starts = findPaths(sample()).map((p) => p.nodeIds[0])
    expect(starts).not.toContain('staff')
    expect(starts).not.toContain('store')
  })

  test('AI를 거치지 않는 경로는 제외', () => {
    const g: Graph = { nodes: [n('doc', 'upload_doc', ['input.untrusted']), n('mail', 'mail_tool', ['tool.send'])], edges: [e('doc', 'mail')] }
    expect(findPaths(g)).toEqual([])
  })

  test('간선 방향이 반대면 경로가 없다', () => {
    const g = sample()
    g.edges = g.edges.map((x) => (x.id === 'ai>mail' ? e('mail', 'ai') : x))
    expect(findPaths(g).map((p) => p.nodeIds[p.nodeIds.length - 1])).not.toContain('ext')
  })

  test('더 이어지는 곳이 없는 도구는 출구, 이어지는 도구는 출구가 아님', () => {
    const g: Graph = {
      nodes: [n('doc', 'upload_doc', ['input.untrusted']), n('ai', 'ai_agent'), n('mail', 'mail_tool', ['tool.send'])],
      edges: [e('doc', 'ai'), e('ai', 'mail')],
    }
    expect(findPaths(g)).toHaveLength(1)
    g.nodes.push(n('ext', 'external_party'))
    g.edges.push(e('mail', 'ext'))
    expect(findPaths(g).map((p) => p.nodeIds)).toEqual([['doc', 'ai', 'mail', 'ext']])
  })

  test('순환이 있어도 끝나고 같은 노드를 두 번 지나지 않는다', () => {
    const g: Graph = {
      nodes: [n('doc', 'upload_doc', ['input.untrusted']), n('ai', 'ai_agent'), n('api', 'ext_api', ['tool.send']), n('ext', 'external_party')],
      edges: [e('doc', 'ai'), e('ai', 'api'), e('api', 'ai'), e('api', 'ext')],
    }
    const paths = findPaths(g)
    expect(paths.map((p) => p.nodeIds)).toEqual([['doc', 'ai', 'api', 'ext']])
    for (const p of paths) expect(new Set(p.nodeIds).size).toBe(p.nodeIds.length)
  })

  test('자기 자신으로 가는 간선과 존재하지 않는 노드를 가리키는 간선은 무시', () => {
    const g = sample()
    g.edges.push(e('ai', 'ai'), e('ai', '없는노드'))
    expect(findPaths(g)).toHaveLength(4)
  })

  test('같은 입력·출구 사이 다른 경로는 병합: 가장 짧은 것이 대표, 나머지는 alternatives', () => {
    const g: Graph = {
      nodes: [n('doc', 'upload_doc', ['input.untrusted']), n('a1', 'ai_agent'), n('a2', 'ai_model'), n('ext', 'external_party')],
      edges: [e('doc', 'a1'), e('a1', 'ext'), e('doc', 'a2'), e('a2', 'a1')],
    }
    const [p] = findPaths(g)
    expect(findPaths(g)).toHaveLength(1)
    expect(p.nodeIds).toEqual(['doc', 'a1', 'ext'])
    expect(p.alternatives).toEqual([['doc', 'a2', 'a1', 'ext']])
  })

  test('입력 노드가 곧 AI인 경우도 경로 시작점이 될 수 있다', () => {
    const g: Graph = { nodes: [n('ai', 'ai_agent', ['input.untrusted']), n('ext', 'external_party')], edges: [e('ai', 'ext')] }
    expect(findPaths(g).map((p) => p.nodeIds)).toEqual([['ai', 'ext']])
  })

  test('폭발 방지: 경로가 아주 많아도 상한 안에서 끝난다', () => {
    const nodes: Graph['nodes'] = [n('doc', 'upload_doc', ['input.untrusted']), n('ext', 'external_party')]
    const edges: Graph['edges'] = []
    for (let layer = 0; layer < 6; layer++)
      for (let i = 0; i < 5; i++) {
        nodes.push(n(`l${layer}_${i}`, 'ai_agent'))
        if (layer === 0) edges.push(e('doc', `l0_${i}`))
        else for (let j = 0; j < 5; j++) edges.push(e(`l${layer - 1}_${j}`, `l${layer}_${i}`))
      }
    for (let i = 0; i < 5; i++) edges.push(e(`l5_${i}`, 'ext'))
    const t = Date.now()
    const paths = findPaths({ nodes, edges })
    expect(Date.now() - t).toBeLessThan(2000)
    expect(paths.length).toBeLessThanOrEqual(MAX_PATHS)
  })

  test('빈 그래프', () => {
    expect(findPaths({ nodes: [], edges: [] })).toEqual([])
  })
})

describe('pathEdgeIds', () => {
  test('경로를 이루는 간선 id', () => {
    expect(pathEdgeIds(sample(), ['doc', 'ai', 'mail', 'ext'])).toEqual(['doc>ai', 'ai>mail', 'mail>ext'])
  })
})

describe('analyze: 경로와 규칙 연결', () => {
  test('시안 구조: 발동 규칙이 경로에 연결되고 심각도는 가장 높은 것', () => {
    const a = analyze(sample(), RULES)
    expect(a.paths).toHaveLength(4)
    const mailPath = a.paths.find((p) => p.nodeIds.join() === 'doc,ai,mail,ext')!
    expect(mailPath.ruleIds).toEqual(expect.arrayContaining(['R-01', 'R-02']))
    expect(mailPath.severity).toBe('high')
    const plcPath = a.paths.find((p) => p.nodeIds.join() === 'sensor,ai,ctl,plc')!
    expect(plcPath.ruleIds).toEqual(expect.arrayContaining(['R-09']))
  })

  test('발동 규칙이 없는 경로는 결과에서 빠진다', () => {
    const g: Graph = {
      nodes: [n('s', 'sensor', ['input.sensor']), n('ai', 'ai_model'), n('ext', 'external_party')],
      edges: [e('s', 'ai'), e('ai', 'ext')],
    }
    expect(findPaths(g)).toHaveLength(1)
    expect(analyze(g, RULES).paths).toEqual([])
  })

  test('대응책(사람 승인)을 적용하면 해당 규칙이 경로에서 사라진다', () => {
    const before = analyze(sample(), RULES).paths.find((p) => p.nodeIds.join() === 'doc,ai,mail,ext')!
    expect(before.ruleIds).toContain('R-24')
    const after = analyze(sample(), RULES, new Set([appliedKey('ai', 'R-01', 'human_approval')])).paths.find((p) => p.nodeIds.join() === 'doc,ai,mail,ext')!
    expect(after.ruleIds).not.toContain('R-24')
  })

  test('결과는 심각도 순', () => {
    const order = { high: 0, medium: 1, low: 2 }
    const sev = analyze(sample(), RULES).paths.map((p) => order[p.severity])
    expect(sev).toEqual([...sev].sort())
  })
})
