import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from './App'

test('앱 제목이 보인다', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'ThreatLens' })).toBeTruthy()
})
