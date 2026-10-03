/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 위험 마름모 네 색이 색각 이상(적색약·녹색약·청색약) 시뮬레이션에서도 서로 구분되는지 확인한다.
 * 시뮬레이션: Machado 외(2009) 완전 이상(severity 1.0) 행렬, 선형 RGB에서 적용. 거리: CIE76 ΔE.
 * 색만으로 구분하지 않도록 마름모에는 글자 라벨도 함께 있다 (이 시험은 보조 안전망).
 */
const tokens = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')
const part = (from: string, to?: string) => {
  const s = tokens.indexOf(from)
  return tokens.slice(s, to ? tokens.indexOf(to, s + 1) : undefined)
}
const read = (css: string) => Object.fromEntries([...css.matchAll(/--(hz-[a-z]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
const light = read(part(':root {', ":root[data-theme='dark']"))
const dark = { ...light, ...read(part(":root[data-theme='dark']")) }

type M = number[][]
const SIM: Record<string, M> = {
  정상: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  적색약: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  녹색약: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  청색약: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}
const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const rgb = (hex: string) => [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255))
const lab = (lin: number[]) => {
  const [r, g, b] = lin
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}
const apply = (m: M, lin: number[]) => m.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])))
const dE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function minPairDistance(colors: Record<string, string>, sim: M) {
  const keys = Object.keys(colors)
  let min = Infinity
  let pair = ''
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const d = dE(lab(apply(sim, rgb(colors[keys[i]]))), lab(apply(sim, rgb(colors[keys[j]]))))
      if (d < min) {
        min = d
        pair = `${keys[i]}~${keys[j]}`
      }
    }
  return { min, pair }
}

const MIN_DE = Number(process.env.CVD_MIN_DE ?? 20)
describe.each([
  ['밝은 도면지', light],
  ['어두운 제어실', dark],
])('위험 네 색 구분 (%s)', (_n, colors) => {
  it('네 색이 모두 정의돼 있다', () => expect(Object.keys(colors)).toHaveLength(4))
  it.each(Object.entries(SIM))(`%s 시뮬레이션에서 가장 가까운 두 색의 거리 ≥ ${MIN_DE}`, (name, m) => {
    const r = minPairDistance(colors, m)
    if (process.env.CVD_PRINT) console.log(_n, name, r.min.toFixed(1), r.pair)
    expect(r.min).toBeGreaterThanOrEqual(MIN_DE)
  })
})
