import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'threatlens.theme.v1'
const EVENT = 'threatlens-theme'

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t
}

export function setTheme(t: Theme) {
  applyTheme(t)
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* 저장이 막혀도 이번 화면에는 적용된다 */
  }
  window.dispatchEvent(new Event(EVENT))
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}
const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => 'light')
}

/** SVG 표식(화살촉)처럼 CSS 변수를 못 쓰는 곳에만 쓰는 값. tokens.css의 --red와 같게 유지한다. */
export const RISK_COLOR: Record<Theme, string> = { light: '#c62828', dark: '#ef7070' }
