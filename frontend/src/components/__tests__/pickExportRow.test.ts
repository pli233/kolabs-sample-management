import { describe, it, expect } from 'vitest'
import { pickExportRow } from '@/lib/picks'

// The picks export is the from→to manifest: original location columns followed
// by the new-location extras, looked up by the row's group (input_id).
describe('pickExportRow', () => {
  const colIndex = { input_id: 0, box: 1, sample_pos: 2 }
  const visible = ['input_id', 'box', 'sample_pos']
  const extraKeys = ['new_box', 'new_position']
  const row = ['425280.01', 'BOX_A', 'A01']

  it('appends extras after the visible (original) columns', () => {
    expect(
      pickExportRow(row, visible, colIndex, extraKeys, {
        new_box: 'BOX_Z',
        new_position: 'H12',
      })
    ).toEqual(['425280.01', 'BOX_A', 'A01', 'BOX_Z', 'H12'])
  })

  it('exports blanks when a group has no / partial destination', () => {
    expect(pickExportRow(row, visible, colIndex, extraKeys, undefined)).toEqual([
      '425280.01',
      'BOX_A',
      'A01',
      '',
      '',
    ])
    expect(
      pickExportRow(row, visible, colIndex, extraKeys, { new_box: 'BOX_Z' })
    ).toEqual(['425280.01', 'BOX_A', 'A01', 'BOX_Z', ''])
  })
})
