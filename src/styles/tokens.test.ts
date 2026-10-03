/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RISK_COLOR } from '../theme'

const SRC = join(import.meta.dirname, '..')
const files: Record<string, string> = {}
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.css')) files[p] = readFileSync(p, 'utf8')
  }
}
walk(SRC)
const tokens = files[join(SRC, 'styles', 'tokens.css')]

function block(selector: string): Record<string, string> {
  const start = tokens.indexOf(selector)
  const body = tokens.slice(tokens.indexOf('{', start) + 1, tokens.indexOf('\n}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}
const light = block(':root {')
const dark = { ...light, ...block(":root[data-theme='dark']") }

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TEXT_PAIRS: [string, string, number][] = [
  ['text', 'bg', 7],
  ['text', 'panel', 7],
  ['muted', 'bg', 4.5],
  ['muted', 'panel', 4.5],
  ['accent', 'panel', 4.5],
  ['red', 'panel', 4.5],
  ['amber', 'panel', 4.5],
  ['green', 'panel', 4.5],
  ['red', 'red-bg', 4.5],
  ['amber', 'amber-bg', 4.5],
  ['green', 'green-bg', 4.5],
  ['status-ink', 'status-bg', 7],
  ['accent-ink', 'accent', 4.5],
  ['line-strong', 'panel', 3],
]

describe.each([
  ['밝은 도면지', light],
  ['어두운 제어실', dark],
])('대비 (%s)', (_name, t) => {
  it.each(TEXT_PAIRS)('%s / %s ≥ %d', (fg, bg, min) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(min)
  })
  it('위험 표식 색은 --red와 같다', () => {
    expect(RISK_COLOR[_name === '밝은 도면지' ? 'light' : 'dark']).toBe(t.red)
  })
})

describe('디자인 토큰', () => {
  it('글자 크기는 5단계, 모서리는 2종류다', () => {
    expect(['fs-xs', 'fs-sm', 'fs-md', 'fs-lg', 'fs-xl'].map((k) => light[k])).toEqual(['12px', '14px', '16px', '20px', '36px'])
    expect([light['radius-sm'], light['radius-md']]).toEqual(['4px', '8px'])
  })

  const css = Object.entries(files).filter(([p]) => !p.endsWith('tokens.css'))

  it('토큰 밖 CSS에는 색 값을 직접 쓰지 않는다', () => {
    const bad = css.flatMap(([p, text]) => [...text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].map((m) => `${p}: ${m[0]}`))
    expect(bad).toEqual([])
  })
  it('토큰 밖 CSS의 글자 크기는 토큰만 쓴다', () => {
    const bad = css.flatMap(([p, text]) => [...text.matchAll(/font-size:\s*([^;}]+)/g)].filter((m) => !m[1].trim().startsWith('var(')).map((m) => `${p}: ${m[0]}`))
    expect(bad).toEqual([])
  })
})
