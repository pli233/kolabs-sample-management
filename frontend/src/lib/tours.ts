export interface TourStep {
  title: string
  body: string
  /** CSS selector for the element to spotlight; centered tooltip if omitted. */
  selector?: string
}

// Anchor every step on an always-visible element so the spotlight lands well.
// Capabilities that only appear after an action (the results table) are taught
// on that action's button rather than on a not-yet-rendered toolbar.

/** Per-route feature walkthroughs, played from the floating Guide button. */
export const TOURS: Record<string, TourStep[]> = {
  '/dashboard': [
    {
      title: 'Active data feed',
      body: 'The dashboard always reflects the active feed — the workbook you selected in Data Feeds.',
      selector: '[data-tour="feed-title"]',
    },
    {
      title: 'Overview',
      body: 'Totals and breakdowns across every row. The Projects and Freezers cards are clickable — open them to list each with its tube count.',
      selector: '[data-tour="overview"]',
    },
    {
      title: 'Search',
      body: 'Search across the entire dataset (all rows, server-side), not just the page you can see.',
      selector: 'input[aria-label="Search all rows"]',
    },
    {
      title: 'Columns',
      body: 'Show or hide columns. Drag a header edge to resize, or drag a header to reorder.',
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
      body: 'Find every location a box number appears in across projects and freezers, with tube counts.',
      selector: 'h1',
    },
    {
      title: 'Enter a box number',
      body: 'Leading zeros are ignored (0728 = 728). Results group by unique location with example tubes, and each group can be exported to Excel/CSV.',
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
      title: 'Project & boxes',
      body: 'Pick a project, then list boxes — ranges like 716-719,722 are supported.',
      selector: 'input[aria-label="Boxes"]',
    },
    {
      title: 'Tubes per box',
      body: 'How many tubes to draw from each box.',
      selector: 'input[aria-label="Per box"]',
    },
    {
      title: 'Seed',
      body: 'Leave on auto for a fresh draw, or set a seed to reproduce the exact same sample later.',
      selector: 'input[aria-label="Seed"]',
    },
    {
      title: 'Sample & review',
      body: 'Results group by box in shaded blocks. The table supports search, show/hide columns, filtering, header drag-reorder, and export.',
      selector: 'button[type="submit"]',
    },
  ],
  '/aliquot-finder': [
    {
      title: 'Aliquot Finder',
      body: 'Recommend a PRIMARY tube plus backups for each person / project_id.',
      selector: 'h1',
    },
    {
      title: 'Paste project + ID pairs',
      body: 'Paste two columns (project, project_id) from Excel — one pair per line. The project disambiguates IDs that repeat across projects. An ID without a decimal matches all aliquots of that person.',
      selector: 'textarea[aria-label="Project and ID pairs"]',
    },
    {
      title: 'Preferred freezer',
      body: 'Optional — bias the PRIMARY pick toward tubes in this freezer.',
      selector: 'input[aria-label="Preferred freezer"]',
    },
    {
      title: 'Backups',
      body: 'How many backup tubes to list per ID, after the PRIMARY.',
      selector: 'input[aria-label="Backups"]',
    },
    {
      title: 'Find & review',
      body: 'The PRIMARY row is highlighted; backups follow. Search, hide columns, filter, reorder, and export the result.',
      selector: 'button[type="submit"]',
    },
  ],
  '/scan-reconcile': [
    {
      title: 'Scan Reconcile',
      body: 'Compare physical rack scans against the active feed — wrong codes, wrong locations, missing tubes, conflicts.',
      selector: 'h1',
    },
    {
      title: 'Upload scan files',
      body: 'Drag in or choose .csv / .xlsx / .xls — multiple files at once. Duplicate scan files are detected and dropped automatically.',
      selector: '[data-tour="scan-dropzone"]',
    },
    {
      title: 'Reconcile & review',
      body: 'Each issue type opens as its own tab. Edits to the feed can be saved, and the floating button exports the updated feed as Excel/CSV.',
      selector: '[data-tour="reconcile"]',
    },
  ],
  '/feeds': [
    {
      title: 'Upload a data feed',
      body: 'Drag in an Excel/CSV file. The newest upload becomes the active feed; multi-sheet workbooks let you pick the primary sheet.',
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
