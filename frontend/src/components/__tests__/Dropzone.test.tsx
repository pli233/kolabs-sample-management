import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Dropzone } from '@/components/Dropzone'

function makeFile(name: string, type: string) {
  return new File(['data'], name, { type })
}

describe('Dropzone', () => {
  it('accepts an xlsx file and calls onFile', async () => {
    const onFile = vi.fn()
    render(<Dropzone onFile={onFile} />)
    const input = screen.getByLabelText('Upload file') as HTMLInputElement
    const file = makeFile(
      'data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(onFile).toHaveBeenCalledTimes(1))
    expect(onFile.mock.calls[0][0].name).toBe('data.xlsx')
  })

  it('rejects an unsupported type and shows an error', async () => {
    const onFile = vi.fn()
    render(<Dropzone onFile={onFile} />)
    const input = screen.getByLabelText('Upload file') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [makeFile('notes.txt', 'text/plain')] },
    })
    await waitFor(() =>
      expect(screen.getByText(/Only/)).toBeInTheDocument()
    )
    expect(onFile).not.toHaveBeenCalled()
  })
})
