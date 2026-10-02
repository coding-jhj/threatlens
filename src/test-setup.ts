import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* node 환경 테스트에는 localStorage가 없다 */
  }
})
afterEach(cleanup)
