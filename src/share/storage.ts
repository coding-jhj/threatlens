import type { EditorGraph } from '../editor/model'
import { parseSaved, serialize, type Saved } from './serialize'

export const AUTOSAVE_KEY = 'threatlens.workspace.v1'

export function loadAutosave(): Saved | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY)
    if (!text) return null
    const r = parseSaved(text)
    return r.ok ? { graph: r.graph, applied: r.applied } : null
  } catch {
    return null
  }
}

export function saveAutosave(graph: EditorGraph, applied: ReadonlySet<string>): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serialize(graph, applied))
  } catch {
    /* 저장 공간이 막히거나 가득 찬 경우: 자동 저장만 건너뛴다 */
  }
}
