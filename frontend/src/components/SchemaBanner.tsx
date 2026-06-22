import { Alert } from '@/components/ui/alert'
import type { MatchStatus, SheetIssue } from '@/lib/api'

const ISSUE_LABEL: Record<string, string> = {
  missing: 'missing',
  extra: 'extra',
  order: 'wrong order',
}

interface SchemaInfo {
  match: MatchStatus
  issues: SheetIssue[]
}

/**
 * Per-sheet schema feedback:
 * - matched  -> no banner
 * - partial  -> warning that lists exactly which columns are wrong (the "why")
 * - other    -> neutral note: an unrelated/auxiliary sheet, shown as-is
 */
export function SchemaBanner({ sheet }: { sheet: SchemaInfo }) {
  if (sheet.match === 'matched') return null

  if (sheet.match === 'other') {
    return (
      <Alert variant="info">
        This sheet doesn't match the schema (likely an auxiliary/summary sheet).
        Shown as-is and not validated.
      </Alert>
    )
  }

  // partial: resembles the main library but has column problems.
  return (
    <Alert variant="warning" className="space-y-1">
      <div className="font-medium">
        Close to the schema, but these columns differ (data still shown):
      </div>
      <ul className="list-disc pl-5">
        {sheet.issues.slice(0, 20).map((iss, i) => (
          <li key={`${iss.type}-${iss.column}-${i}`}>
            {ISSUE_LABEL[iss.type] ?? iss.type}: <code>{iss.column}</code>
          </li>
        ))}
      </ul>
    </Alert>
  )
}
