import { describe, expect, test } from 'vitest'
import { EMPTY_STATE, HISTORY_LIMIT, LAYOUT, autoLayout, reducer, type Action, type EditorState } from './model'

const run = (actions: Action[], start: EditorState = EMPTY_STATE) => actions.reduce(reducer, start)
const add = (partId: string, x = 0, y = 0): Action => ({ type: 'addNode', partId, x, y })

describe('노드·간선 편집', () => {
  test('부품 추가: 기본 속성이 복사되고 id가 증가', () => {
    const s = run([add('upload_doc', 10, 20), add('ai_agent')])
    expect(s.graph.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(s.graph.nodes[0]).toMatchObject({ partId: 'upload_doc', attributes: ['input.untrusted'], x: 10, y: 20 })
  })

  test('기본 속성 배열은 부품 정의와 분리(수정해도 정의가 안 바뀜)', () => {
    const s = run([add('upload_doc')])
    s.graph.nodes[0].attributes.push('tool.send')
    expect(run([add('upload_doc')]).graph.nodes[0].attributes).toEqual(['input.untrusted'])
  })

  test('없는 부품은 무시', () => {
    expect(run([add('없음')])).toBe(EMPTY_STATE)
  })

  test('연결: 자기 자신·중복·없는 노드는 거부, 반대 방향은 허용', () => {
    const s = run([add('upload_doc'), add('ai_agent'), { type: 'connect', from: 'n1', to: 'n2' }])
    expect(s.graph.edges).toHaveLength(1)
    expect(run([{ type: 'connect', from: 'n1', to: 'n1' }], s).graph.edges).toHaveLength(1)
    expect(run([{ type: 'connect', from: 'n1', to: 'n2' }], s).graph.edges).toHaveLength(1)
    expect(run([{ type: 'connect', from: 'n1', to: 'zz' }], s).graph.edges).toHaveLength(1)
    expect(run([{ type: 'connect', from: 'n2', to: 'n1' }], s).graph.edges).toHaveLength(2)
  })

  test('노드 삭제 시 연결된 간선도 함께 삭제', () => {
    const s = run([add('upload_doc'), add('ai_agent'), add('mail_tool'), { type: 'connect', from: 'n1', to: 'n2' }, { type: 'connect', from: 'n2', to: 'n3' }, { type: 'remove', nodeIds: ['n2'], edgeIds: [] }])
    expect(s.graph.nodes.map((n) => n.id)).toEqual(['n1', 'n3'])
    expect(s.graph.edges).toEqual([])
  })

  test('간선 삭제', () => {
    const s = run([add('upload_doc'), add('ai_agent'), { type: 'connect', from: 'n1', to: 'n2' }])
    const id = s.graph.edges[0].id
    expect(run([{ type: 'remove', nodeIds: [], edgeIds: [id] }], s).graph.edges).toEqual([])
  })

  test('아무 변화 없는 동작은 기록을 쌓지 않는다', () => {
    const s = run([add('upload_doc')])
    expect(run([{ type: 'remove', nodeIds: ['없음'], edgeIds: ['없음'] }, { type: 'moveNodes', positions: {} }, { type: 'moveNodes', positions: { n1: { x: 0, y: 0 } } }], s)).toBe(s)
  })

  test('속성 설정: 같으면 변화 없음, 다르면 반영', () => {
    const s = run([add('ai_agent')])
    expect(run([{ type: 'setAttributes', nodeId: 'n1', attributes: [] }], s)).toBe(s)
    expect(run([{ type: 'setAttributes', nodeId: 'n1', attributes: ['tool.exec'] }], s).graph.nodes[0].attributes).toEqual(['tool.exec'])
  })

  test('이동', () => {
    const s = run([add('ai_agent'), { type: 'moveNodes', positions: { n1: { x: 50, y: 70 } } }])
    expect(s.graph.nodes[0]).toMatchObject({ x: 50, y: 70 })
  })
})

describe('되돌리기·다시 실행', () => {
  test('undo/redo 왕복', () => {
    const a = run([add('upload_doc'), add('ai_agent')])
    const u = run([{ type: 'undo' }], a)
    expect(u.graph.nodes).toHaveLength(1)
    expect(run([{ type: 'redo' }], u).graph).toEqual(a.graph)
  })

  test('새 편집은 redo 기록을 지운다', () => {
    const s = run([add('upload_doc'), { type: 'undo' }, add('ai_agent')])
    expect(s.future).toEqual([])
    expect(run([{ type: 'redo' }], s)).toBe(s)
  })

  test('처음 상태에서 undo는 무시', () => {
    expect(run([{ type: 'undo' }])).toBe(EMPTY_STATE)
  })

  test('노드+딸린 간선 삭제는 되돌리기 한 번으로 모두 복원 (RF가 노드·간선 삭제를 함께 알려도 한 동작)', () => {
    const s = run([add('upload_doc'), add('ai_agent'), { type: 'connect', from: 'n1', to: 'n2' }])
    const del = run([{ type: 'remove', nodeIds: ['n1'], edgeIds: ['e4'] }], s)
    expect(run([{ type: 'undo' }], del).graph).toEqual(s.graph)
  })

  test('undo 후 추가해도 id가 겹치지 않는다', () => {
    const s = run([add('upload_doc'), add('ai_agent'), { type: 'undo' }, add('mail_tool')])
    expect(new Set(s.graph.nodes.map((n) => n.id)).size).toBe(s.graph.nodes.length)
    expect(s.graph.nodes.map((n) => n.id)).toEqual(['n1', 'n3'])
  })

  test(`기록은 최대 ${HISTORY_LIMIT}개`, () => {
    let s = EMPTY_STATE
    for (let i = 0; i < HISTORY_LIMIT + 30; i++) s = reducer(s, add('user'))
    expect(s.past).toHaveLength(HISTORY_LIMIT)
  })

  test('load는 기록을 비우고 이후 id가 겹치지 않는다', () => {
    const base = run([add('upload_doc'), add('ai_agent'), { type: 'connect', from: 'n1', to: 'n2' }])
    const s = run([{ type: 'load', graph: base.graph }, add('mail_tool')])
    expect(s.past).toHaveLength(1)
    expect(s.graph.nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n4'])
  })
})

describe('autoLayout', () => {
  const chain = () =>
    run([add('upload_doc', 500, 500), add('ai_agent', 5, 5), add('mail_tool', 9, 9), add('external_party', 1, 1), { type: 'connect', from: 'n1', to: 'n2' }, { type: 'connect', from: 'n2', to: 'n3' }, { type: 'connect', from: 'n3', to: 'n4' }]).graph

  test('입력→AI→도구→외부 순으로 왼쪽→오른쪽 열 배치', () => {
    const out = autoLayout(chain())
    expect(out.nodes.map((n) => n.x)).toEqual([0, 1, 2, 3].map((i) => LAYOUT.originX + i * LAYOUT.colWidth))
  })

  test('같은 열의 노드는 기존 위아래 순서를 유지하며 겹치지 않는다', () => {
    const s = run([add('upload_doc', 0, 300), add('sensor', 0, 100), add('ai_agent'), { type: 'connect', from: 'n1', to: 'n3' }, { type: 'connect', from: 'n2', to: 'n3' }])
    const out = autoLayout(s.graph)
    const doc = out.nodes.find((n) => n.id === 'n1')!
    const sensor = out.nodes.find((n) => n.id === 'n2')!
    expect(sensor.y).toBeLessThan(doc.y)
    expect(doc.y - sensor.y).toBe(LAYOUT.rowHeight)
    expect(doc.x).toBe(sensor.x)
  })

  test('순환이 있어도 끝난다', () => {
    const s = run([add('ai_agent'), add('ext_api'), { type: 'connect', from: 'n1', to: 'n2' }, { type: 'connect', from: 'n2', to: 'n1' }])
    expect(() => autoLayout(s.graph)).not.toThrow()
  })

  test('autoLayout 동작은 기록에 남아 되돌릴 수 있다', () => {
    const before = chain()
    const s = run([{ type: 'load', graph: before }, { type: 'autoLayout' }, { type: 'undo' }])
    expect(s.graph).toEqual(before)
  })

  test('간선/속성 등 이동 외 정보는 바뀌지 않는다', () => {
    const out = autoLayout(chain())
    expect(out.edges).toEqual(chain().edges)
    expect(out.nodes.map((n) => n.attributes)).toEqual(chain().nodes.map((n) => n.attributes))
  })
})
