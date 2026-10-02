import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { EMPTY_STATE, reducer, type EditorGraph, type EditorState } from './editor/model'
import { pruneApplied } from './editor/threat'
import { parseShareHash } from './share/serialize'
import { loadAutosave, saveAutosave } from './share/storage'

interface Start {
  state: EditorState
  applied: ReadonlySet<string>
  notice: string | null
}

/** 처음 열 때의 상태: 공유 링크 > 자동 저장 > 빈 화면. (읽기만 하고 아무것도 바꾸지 않는다) */
function initial(): Start {
  const shared = parseShareHash(location.hash)
  if (shared) {
    if (shared.ok) return { state: reducer(EMPTY_STATE, { type: 'load', graph: shared.graph }), applied: new Set(shared.applied), notice: '공유 링크의 구조를 불러왔습니다.' }
    return { ...fromAutosave(), notice: `공유 링크를 열 수 없습니다: ${shared.error}` }
  }
  return { ...fromAutosave(), notice: null }
}

function fromAutosave(): Omit<Start, 'notice'> {
  const saved = loadAutosave()
  if (!saved || saved.graph.nodes.length === 0) return { state: EMPTY_STATE, applied: new Set() }
  return { state: reducer(EMPTY_STATE, { type: 'load', graph: saved.graph }), applied: new Set(saved.applied) }
}

/** 편집기와 보고서가 함께 쓰는 작업 상태 (구조 + 적용한 대응). 바뀔 때마다 자동 저장한다. */
export function useWorkspace() {
  const [start] = useState(initial)
  const [state, dispatch] = useReducer(reducer, start.state)
  const [appliedRaw, setApplied] = useState<ReadonlySet<string>>(start.applied)
  const applied = useMemo(() => pruneApplied(appliedRaw, state.graph), [appliedRaw, state.graph])

  useEffect(() => {
    saveAutosave(state.graph, applied)
  }, [state.graph, applied])

  const [notice, setNotice] = useState<string | null>(start.notice)
  const flash = useCallback((msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 4000)
  }, [])
  useEffect(() => {
    if (!start.notice) return
    const t = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(t)
  }, [start.notice])

  /** 구조를 통째로 바꾼다 (되돌리기로 이전 구조 복원 가능) */
  const replaceAll = useCallback((graph: EditorGraph, nextApplied: Iterable<string> = []) => {
    dispatch({ type: 'replace', graph })
    setApplied(new Set(nextApplied))
  }, [])

  return { state, dispatch, applied, setApplied, replaceAll, notice, flash }
}
export type Workspace = ReturnType<typeof useWorkspace>
