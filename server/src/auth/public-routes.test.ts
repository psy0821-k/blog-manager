import { describe, expect, it } from 'vitest'
import { isPublicRoute } from './public-routes'

describe('isPublicRoute', () => {
  it('GET /health일 때 true여야 한다', () => {
    expect(isPublicRoute('GET', '/health')).toBe(true)
  })

  it('POST /health일 때 false여야 한다', () => {
    expect(isPublicRoute('POST', '/health')).toBe(false)
  })

  it('GET /health/extra일 때 false여야 한다', () => {
    expect(isPublicRoute('GET', '/health/extra')).toBe(false)
  })

  it('GET /auth/check일 때 false여야 한다', () => {
    expect(isPublicRoute('GET', '/auth/check')).toBe(false)
  })
})
