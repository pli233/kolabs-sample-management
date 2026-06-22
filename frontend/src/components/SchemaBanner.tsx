import { Alert } from '@/components/ui/alert'
import type { MatchStatus, SheetIssue } from '@/lib/api'

const ISSUE_LABEL: Record<string, string> = {
  missing: '缺少列',
  extra: '多出列',
  order: '列顺序不符',
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
        该工作表不是主库结构(可能是辅助/汇总表),已按原样展示,不参与主库校验。
      </Alert>
    )
  }

  // partial: resembles the main library but has column problems.
  return (
    <Alert variant="warning" className="space-y-1">
      <div className="font-medium">
        该工作表接近主库结构,但有以下列不符(数据仍可查看):
      </div>
      <ul className="list-disc pl-5">
        {sheet.issues.slice(0, 20).map((iss, i) => (
          <li key={`${iss.type}-${iss.column}-${i}`}>
            {ISSUE_LABEL[iss.type] ?? iss.type}:<code>{iss.column}</code>
          </li>
        ))}
      </ul>
    </Alert>
  )
}
