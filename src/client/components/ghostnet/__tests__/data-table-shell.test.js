import React from 'react'
import { render, screen } from '@testing-library/react'
import { DataTableShell } from '../data-table-shell'

describe('DataTableShell', () => {
  it('renders the table when populated', () => {
    render(
      <DataTableShell
        ariaLabel='Sample manifest'
        hasData
        status='populated'
      >
        <tbody>
          <tr>
            <td>Row A</td>
          </tr>
        </tbody>
      </DataTableShell>
    )

    expect(screen.getByRole('table', { name: /sample manifest/i })).toBeInTheDocument()
  })

  it('announces shared empty states when no data is present', () => {
    render(
      <DataTableShell
        ariaLabel='Empty manifest'
        emptyMessage='No cargo detected.'
        hasData={false}
        status='empty'
      >
        <tbody />
      </DataTableShell>
    )

    expect(screen.getByText('No cargo detected.')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: /empty manifest/i })).not.toBeInTheDocument()
  })

  it('marks the container busy while loading content', () => {
    render(
      <DataTableShell
        ariaLabel='Loading manifest'
        hasData={false}
        loadingContent={<span data-testid='loading-indicator'>Loading…</span>}
        status='loading'
      >
        <tbody />
      </DataTableShell>
    )

    expect(screen.getByRole('region')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})
