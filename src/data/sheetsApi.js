const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

async function apiGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sheets API ${res.status}: ${body}`)
  }
  return res.json()
}

async function apiPost(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = await res.text().catch(() => '')
    throw new Error(`Sheets API ${res.status}: ${b}`)
  }
  return res.json()
}

// ── Metadata ─────────────────────────────────────────────────────

export async function getSpreadsheetMeta(sheetId, token) {
  return apiGet(`${BASE}/${sheetId}?fields=sheets.properties`, token)
}

export function findSheetNameByGid(meta, gid) {
  const s = meta.sheets.find(s => String(s.properties.sheetId) === String(gid))
  return s?.properties?.title ?? null
}

export function findArchivedSheetInfo(meta) {
  const s = meta.sheets.find(s => s.properties.title.toLowerCase() === 'archived')
  if (!s) return null
  return { name: s.properties.title, gid: s.properties.sheetId }
}

// ── Low-level helpers ─────────────────────────────────────────────

async function readRange(sheetId, range, token) {
  const data = await apiGet(`${BASE}/${sheetId}/values/${encodeURIComponent(range)}`, token)
  return data.values || []
}

async function appendRows(sheetId, sheetName, rows, token) {
  // Read col B (Product — always populated) to find the last data row.
  // This avoids the Sheets API table-detection heuristic that can anchor writes
  // at col B when col A is hidden, and instead writes to an explicit A${n} address.
  const colB = await readRange(sheetId, `${sheetName}!B:B`, token)
  const nextRow = colB.length + 1  // 1-indexed; colB includes the header row

  await apiPost(`${BASE}/${sheetId}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: rows.map((row, i) => ({
      range: `${sheetName}!A${nextRow + i}`,
      values: [row],
    })),
  }, token)
}

async function deleteRowByIndex(sheetId, sheetGid, rowIndex, token) {
  await apiPost(`${BASE}/${sheetId}:batchUpdate`, {
    requests: [{
      deleteDimension: {
        range: { sheetId: Number(sheetGid), dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
      },
    }],
  }, token)
}

// Returns the 0-indexed row position (skipping header at 0), or null if not found.
// Searches column A of the given sheet for a matching numeric ID.
async function findRowIndexById(sheetId, sheetName, numericId, token) {
  const colA = await readRange(sheetId, `${sheetName}!A:A`, token)
  for (let i = 1; i < colA.length; i++) {
    if (String(colA[i]?.[0] ?? '').trim() === String(numericId)) return i
  }
  return null
}

// ── Public API ────────────────────────────────────────────────────

export async function fillMissingIds(config, token) {
  const { sheetId, mainSheetName } = config
  // Read A:B — col B (Product) always has data, so the API returns trailing rows
  // even when col A (ID) is empty. Reading only A:A silently drops those rows.
  const rows = await readRange(sheetId, `${mainSheetName}!A:B`, token)

  // Collect all existing IDs upfront so generated IDs never collide with them
  const allIds = new Set()
  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i]?.[0] ?? '').trim()
    if (id) allIds.add(id)
  }

  let nextId = Date.now()
  const uniqueId = () => {
    while (allIds.has(String(nextId))) nextId++
    const id = String(nextId++)
    allIds.add(id)
    return id
  }

  const updates = []
  const seen = new Set() // tracks IDs already assigned in this pass (catches duplicates)

  for (let i = 1; i < rows.length; i++) {
    const id      = String(rows[i]?.[0] ?? '').trim()
    const product = String(rows[i]?.[1] ?? '').trim()
    if (!product) continue // skip blank rows

    if (!id || seen.has(id)) {
      // Missing or duplicate — assign a fresh unique ID
      const newId = uniqueId()
      seen.add(newId)
      updates.push({ range: `${mainSheetName}!A${i + 1}`, values: [[newId]] })
    } else {
      seen.add(id)
    }
  }

  if (updates.length === 0) return

  await apiPost(`${BASE}/${sheetId}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: updates,
  }, token)
}

// Archived tab column layout (same as Main cols 0-6):
//   A: ID  B: Product  C: Market  D: Name  E: FRF  F: PRD  G: JIRA
// Stage, version, and all timeline columns are stripped when archiving.

export async function readArchivedRows(config, token) {
  const { sheetId, archivedSheetName } = config
  if (!archivedSheetName) return []

  const rows = await readRange(sheetId, `${archivedSheetName}!A:G`, token)
  return rows.slice(1)
    .map(row => ({
      id:       `fs${String(row[0] ?? '').trim()}`,
      product:  String(row[1] ?? ''),
      market:   String(row[2] ?? ''),
      name:     String(row[3] ?? ''),
      frf:      String(row[4] ?? ''),
      prd:      String(row[5] ?? ''),
      jira:     String(row[6] ?? ''),
      stage:    'pipeline',
      version:  '',
      timeline: {},
      createdAt: Date.now(),
      archived: true,
    }))
    .filter(r => r.id !== 'fs')
}

export async function archiveRow(config, rowId, token) {
  const { sheetId, mainSheetName, mainSheetGid, archivedSheetName } = config
  if (!archivedSheetName) throw new Error('No Archived sheet found. Add a tab named "Archived" to your spreadsheet.')

  const numericId = rowId.replace(/^fs/, '')

  const rowIndex = await findRowIndexById(sheetId, mainSheetName, numericId, token)
  if (rowIndex === null) return

  // Read with explicit A:G bounds so the returned array always starts at col A,
  // regardless of whether col A is hidden in the sheet UI.
  const rows = await readRange(sheetId, `${mainSheetName}!A${rowIndex + 1}:G${rowIndex + 1}`, token)
  const row = rows[0] ?? []
  const archiveData = [
    row[0] ?? '',  // A: ID
    row[1] ?? '',  // B: Product
    row[2] ?? '',  // C: Market
    row[3] ?? '',  // D: Name
    row[4] ?? '',  // E: FRF
    row[5] ?? '',  // F: PRD
    row[6] ?? '',  // G: JIRA
  ]
  await appendRows(sheetId, archivedSheetName, [archiveData], token)

  const freshIndex = await findRowIndexById(sheetId, mainSheetName, numericId, token)
  if (freshIndex !== null) await deleteRowByIndex(sheetId, mainSheetGid, freshIndex, token)
}

export async function unarchiveRow(config, rowId, token) {
  const { sheetId, mainSheetName, archivedSheetName, archivedSheetGid } = config
  if (!archivedSheetName) return

  const numericId = rowId.replace(/^fs/, '')

  const rowIndex = await findRowIndexById(sheetId, archivedSheetName, numericId, token)
  if (rowIndex === null) return

  // Read with explicit A:G bounds so the returned array always starts at col A.
  const rows = await readRange(sheetId, `${archivedSheetName}!A${rowIndex + 1}:G${rowIndex + 1}`, token)
  const row = rows[0] ?? []
  const mainData = [
    row[0] ?? '',  // A: ID
    row[1] ?? '',  // B: Product
    row[2] ?? '',  // C: Market
    row[3] ?? '',  // D: Name
    row[4] ?? '',  // E: FRF
    row[5] ?? '',  // F: PRD
    row[6] ?? '',  // G: JIRA
    'pipeline',    // H: Stage
    '',            // I: Version
    '', '', '', '', '', '',  // J-O: timeline
  ]
  await appendRows(sheetId, mainSheetName, [mainData], token)

  const freshIndex = await findRowIndexById(sheetId, archivedSheetName, numericId, token)
  if (freshIndex !== null) await deleteRowByIndex(sheetId, archivedSheetGid, freshIndex, token)
}

export async function deleteRow(config, rowId, token) {
  const { sheetId, mainSheetName, mainSheetGid } = config
  const numericId = rowId.replace(/^fs/, '')
  const rowIndex = await findRowIndexById(sheetId, mainSheetName, numericId, token)
  if (rowIndex === null) return
  await deleteRowByIndex(sheetId, mainSheetGid, rowIndex, token)
}
