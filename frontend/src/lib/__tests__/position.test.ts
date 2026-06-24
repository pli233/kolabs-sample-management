import { describe, it, expect } from 'vitest'
import { parsePosition, formatPosition, rowToLetters } from '@/lib/position'

describe('parsePosition', () => {
  it('parses zero-padded, unpadded, and lowercase forms', () => {
    expect(parsePosition('A01')).toEqual({ row: 0, col: 1, canonical: 'A01' })
    expect(parsePosition('A1')).toEqual({ row: 0, col: 1, canonical: 'A01' })
    expect(parsePosition('b3')).toEqual({ row: 1, col: 3, canonical: 'B03' })
    expect(parsePosition('H12')).toEqual({ row: 7, col: 12, canonical: 'H12' })
  })

  it('rejects junk', () => {
    expect(parsePosition('')).toBeNull()
    expect(parsePosition('A')).toBeNull()
    expect(parsePosition('12')).toBeNull()
    expect(parsePosition('A0')).toBeNull()
  })

  it('round-trips with formatPosition', () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 12; c++) {
        const canon = formatPosition(r, c)
        expect(parsePosition(canon)).toEqual({ row: r, col: c + 1, canonical: canon })
      }
    }
  })
})

describe('rowToLetters', () => {
  it('handles single and double letters', () => {
    expect(rowToLetters(0)).toBe('A')
    expect(rowToLetters(25)).toBe('Z')
    expect(rowToLetters(26)).toBe('AA')
  })
})
