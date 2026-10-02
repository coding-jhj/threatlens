import { useMemo, useReducer, useState } from 'react'
import { EMPTY_STATE, reducer } from './editor/model'
import { pruneApplied } from './editor/threat'

/** 편집기와 보고서가 함께 쓰는 작업 상태 (구조 + 적용한 대응) */
export function useWorkspace() {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE)
  const [appliedRaw, setApplied] = useState<ReadonlySet<string>>(new Set())
  const applied = useMemo(() => pruneApplied(appliedRaw, state.graph), [appliedRaw, state.graph])
  return { state, dispatch, applied, setApplied }
}
export type Workspace = ReturnType<typeof useWorkspace>
