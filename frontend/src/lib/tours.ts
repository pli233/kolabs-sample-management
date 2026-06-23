export interface TourStep {
  title: string
  body: string
  /** CSS selector for the element to spotlight; centered tooltip if omitted. */
  selector?: string
}

/** Per-route feature walkthroughs, played from the floating Tour button. */
export const TOURS: Record<string, TourStep[]> = {
  '/dashboard': [
    {
      title: 'Active data feed',
      body: 'The dashboard always shows the active feed — the workbook you selected in Data Feeds.',
      selector: '[data-tour="feed-title"]',
    },
    {
      title: 'At-a-glance overview',
      body: 'Totals and breakdowns by freezer and project, computed across every row.',
      selector: '[data-tour="overview"]',
    },
    {
      title: 'Columns',
      body: 'Choose which of the columns to display; drag a header edge to resize.',
      selector: 'button[aria-label="Choose visible columns"]',
    },
    {
      title: 'Filter',
      body: 'Build per-column conditions (contains, equals, >, is empty…) combined with Match all / any — applied across the whole dataset.',
      selector: 'button[aria-label="Filter by column"]',
    },
    {
      title: 'Export',
      body: 'Download the current filtered, sorted view as a styled Excel or CSV file.',
      selector: 'button[aria-label="Export"]',
    },
  ],
  '/box-lookup': [
    {
      title: 'Box Lookup',
      body: 'Find every location a box number appears in across projects and freezers.',
      selector: 'h1',
    },
    {
      title: 'Enter a box number',
      body: 'Leading zeros are ignored (0728 = 728). Results group by unique location with example tubes.',
      selector: 'input[aria-label="Box number"]',
    },
  ],
  '/qc-sampler': [
    {
      title: 'QC Sampler',
      body: 'Randomly pick N tubes per box for quality control.',
      selector: 'h1',
    },
    {
      title: 'Boxes & seed',
      body: 'Boxes support ranges like 716-719,722. A seed makes the sample reproducible.',
      selector: 'input[aria-label="Boxes"]',
    },
  ],
  '/aliquot-finder': [
    {
      title: 'Aliquot Finder',
      body: 'Recommend a PRIMARY tube plus backups for each person/project_id.',
      selector: 'h1',
    },
    {
      title: 'Paste IDs',
      body: 'IDs without a decimal match all aliquots of that person. Separate by spaces, commas, or newlines.',
      selector: 'textarea[aria-label="IDs"]',
    },
  ],
  '/scan-reconcile': [
    {
      title: 'Scan Reconcile',
      body: 'Compare physical rack scans against the active feed.',
      selector: 'h1',
    },
    {
      title: 'Upload scan files',
      body: 'Accepts .csv / .xlsx / .xls. Duplicate scan files are detected and dropped automatically.',
      selector: 'input[aria-label="Scan files"]',
    },
  ],
  '/feeds': [
    {
      title: 'Upload a data feed',
      body: 'Drag in an Excel/CSV file. The newest upload becomes the active feed.',
      selector: '[data-testid="dropzone"]',
    },
    {
      title: 'Manage feeds',
      body: 'Switch the active feed with “Set active”, or remove one with the trash icon.',
      selector: '[data-tour="feed-list"]',
    },
  ],
}

export function tourFor(pathname: string): TourStep[] {
  return TOURS[pathname] ?? []
}
