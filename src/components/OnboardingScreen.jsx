import { useState, useCallback } from 'react'
import { getSpreadsheetMeta, findSheetNameByGid, findArchivedSheetInfo, readArchivedHeaderRow } from '../data/sheetsApi'
import { getSheetCsvUrl, validateMainHeaders, validateArchivedHeaders } from '../data/sheets'
import { Button } from './UI'

const TEMPLATE_URL = 'https://docs.google.com/spreadsheets/d/1ollK2VBWk2UOFFHw-CK2LK39EL3SaJDO1slgd6ji6Mo/copy'

function parseSheetUrl(url) {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!idMatch) return null
  const sheetId = idMatch[1]
  const gidMatch = url.match(/[#&]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'
  return { sheetId, gid }
}

// ── Step indicator ────────────────────────────────────────────────

function StepDot({ n, active, done }) {
  const bg = done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--border2)'
  const color = done || active ? '#fff' : 'var(--text3)'
  return (
    <div style={{
      width: 24, height: 24, borderRadius: '50%',
      background: bg, color, fontSize: 11, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {done ? '✓' : n}
    </div>
  )
}

// ── Inline status line ────────────────────────────────────────────

function StatusLine({ status, message }) {
  if (!message) return null
  const color = status === 'ok' ? 'var(--green, #4caf82)' : 'var(--red)'
  return (
    <p style={{ margin: '8px 0 0', fontSize: 12, color, lineHeight: 1.5 }}>
      {status === 'ok' ? '✓ ' : '✕ '}{message}
    </p>
  )
}

// ── Requirement bullet list ───────────────────────────────────────

function ReqList({ items }) {
  return (
    <ul style={{ margin: '0 0 12px', padding: '0 0 0 16px', listStyle: 'disc' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 2 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

// ── Main component ────────────────────────────────────────────────

export function OnboardingScreen({ clientId, saveConfig, saveToken, setAuthState }) {
  const [sheetUrl, setSheetUrl]       = useState('')
  const [parsed, setParsed]           = useState(null)
  const [step1State, setStep1State]   = useState('idle') // idle|checking|ok|error
  const [step1Msg, setStep1Msg]       = useState('')
  const [oauthState, setOauthState]   = useState('idle') // idle|pending|verifying|ok|error
  const [oauthMsg, setOauthMsg]       = useState('')

  const onUrlChange = useCallback((e) => {
    const val = e.target.value
    setSheetUrl(val)
    setParsed(parseSheetUrl(val.trim()))
    setStep1State('idle')
    setStep1Msg('')
    setOauthState('idle')
    setOauthMsg('')
  }, [])

  const checkAccess = useCallback(async () => {
    if (!parsed) return
    setStep1State('checking')
    setStep1Msg('')
    try {
      const csvUrl = getSheetCsvUrl(parsed)
      const res = await fetch(csvUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()

      if (text.trimStart().startsWith('<')) {
        setStep1State('error')
        setStep1Msg(
          'Sheet is not publicly readable. In Google Sheets: Share → Anyone with the link → Viewer, then retry.'
        )
        return
      }

      const headerErrors = validateMainHeaders(text)
      if (headerErrors.length > 0) {
        setStep1State('error')
        setStep1Msg(
          `Column format does not match the template:\n${headerErrors.join('\n')}\nSee the template for the correct column names and order.`
        )
        return
      }

      setStep1State('ok')
      setStep1Msg('Sheet is accessible and column format is correct.')
    } catch {
      setStep1State('error')
      setStep1Msg('Could not reach this sheet. Check the URL and your internet connection.')
    }
  }, [parsed])

  const signInWithGoogle = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      setOauthMsg('Google sign-in is not available yet. Please refresh the page and try again.')
      setOauthState('error')
      return
    }
    setOauthState('pending')
    setOauthMsg('')

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setOauthState('error')
          setOauthMsg('Sign in was cancelled or failed. Please try again.')
          return
        }

        setOauthState('verifying')
        try {
          const meta = await getSpreadsheetMeta(parsed.sheetId, resp.access_token)
          const mainSheetName = findSheetNameByGid(meta, parsed.gid)

          if (!mainSheetName) {
            throw new Error(
              'Could not identify the tab from this URL. Copy the URL while viewing the tab that contains your timeline data, then try again.'
            )
          }

          const archivedInfo = findArchivedSheetInfo(meta)

          // Validate Archived tab columns if it exists
          if (archivedInfo) {
            const archivedHeaderRow = await readArchivedHeaderRow(
              parsed.sheetId, archivedInfo.name, resp.access_token
            )
            const archivedErrors = validateArchivedHeaders(archivedHeaderRow)
            if (archivedErrors.length > 0) {
              throw new Error(
                `Your Archived tab column format does not match the template:\n${archivedErrors.join('\n')}`
              )
            }
          }

          saveConfig({
            sheetId: parsed.sheetId,
            gid: parsed.gid,
            mainSheetName,
            mainSheetGid: Number(parsed.gid),
            archivedSheetName:  archivedInfo?.name  ?? null,
            archivedSheetGid:   archivedInfo?.gid   ?? null,
          })
          saveToken(resp.access_token, resp.expires_in || 3600)

          setOauthState('ok')
          setOauthMsg('Connected.')
          setTimeout(() => setAuthState('ready'), 600)
        } catch (e) {
          setOauthState('error')
          setOauthMsg(
            e.message ||
            'Could not verify sheet access. Make sure you signed in with the account that owns or has access to this sheet.'
          )
        }
      },
      error_callback: () => {
        setOauthState('error')
        setOauthMsg('Sign in was cancelled. Please try again.')
      },
    })
    client.requestAccessToken()
  }, [clientId, parsed, saveConfig, saveToken, setAuthState])

  const step2Unlocked = step1State === 'ok'
  const isBusy = step1State === 'checking' || oauthState === 'pending' || oauthState === 'verifying'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        padding: '36px 40px',
      }}>
        {/* Header */}
        <p style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--text3)', margin: '0 0 6px',
        }}>
          Timeline Tracker
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
          Connect your Google Sheet
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Your data stays in your own spreadsheet. This app reads and writes to it directly.
        </p>

        {/* Template callout */}
        <div style={{
          border: '1px solid var(--border2)',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 28,
          background: 'var(--surface2)',
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>
            Starting fresh?
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 10px', lineHeight: 1.5 }}>
            Use our template — it has the correct column layout and sample rows already set up.
          </p>
          <a
            href={TEMPLATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600,
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            Open template ↗
          </a>
        </div>

        {/* Step 1 */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
          <div style={{ paddingTop: 2 }}>
            <StepDot n={1} active={step1State !== 'ok'} done={step1State === 'ok'} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
              Paste your Google Sheet URL
            </p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 8px', lineHeight: 1.5 }}>
              Copy the URL while viewing the tab with your timeline data — the tab ID is captured automatically.
            </p>
            <ReqList items={[
              'Share the sheet as Anyone with the link → Viewer, and keep it public — the app reads it on every load.',
              'Your spreadsheet must have your main tab (any name — paste its URL here) and a second tab named exactly Archived.',
              'Both tabs must have columns matching the template. Do not add, remove, or reorder columns.',
              'Timeline date format: YYYY/MM/DD-YYYY/MM/DD (e.g. 2026/06/01-2026/06/14).',
              'Rows are auto-grouped by Product and Market for display in the UI board.',
            ]} />
            <input
              value={sheetUrl}
              onChange={onUrlChange}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              disabled={isBusy}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg)',
                border: `1px solid ${step1State === 'error' ? 'var(--red)' : 'var(--border2)'}`,
                borderRadius: 6,
                color: 'var(--text)',
                fontFamily: 'var(--mono)', fontSize: 12,
                padding: '9px 12px',
                outline: 'none',
              }}
            />
            <div style={{ marginTop: 10 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkAccess}
                disabled={!parsed || isBusy || step1State === 'ok'}
              >
                {step1State === 'checking' ? 'Checking…' : 'Check access'}
              </Button>
            </div>
            {step1State === 'error' && step1Msg && (
              <div style={{
                marginTop: 8,
                fontSize: 12, color: 'var(--red)',
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
              }}>
                ✕ {step1Msg}
                {step1Msg.includes('template') && (
                  <span> <a
                    href={TEMPLATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                  >Open template ↗</a></span>
                )}
              </div>
            )}
            {step1State === 'ok' && (
              <StatusLine status="ok" message={step1Msg} />
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 28, opacity: step2Unlocked ? 1 : 0.35 }} />

        {/* Step 2 */}
        <div style={{
          display: 'flex', gap: 14,
          opacity: step2Unlocked ? 1 : 0.35,
          pointerEvents: step2Unlocked ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}>
          <div style={{ paddingTop: 2 }}>
            <StepDot n={2} active={step2Unlocked && oauthState !== 'ok'} done={oauthState === 'ok'} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
              Sign in with Google
            </p>
            <p style={{ fontSize: 12, color: 'var(--text3)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Grants write access so the app can update your sheet directly. Your data lives entirely
              within your own Google account — nothing is stored outside your browser.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={signInWithGoogle}
              disabled={!step2Unlocked || isBusy || oauthState === 'ok'}
            >
              {oauthState === 'pending'   ? 'Opening Google sign-in…'
                : oauthState === 'verifying' ? 'Verifying access…'
                : 'Sign in with Google'}
            </Button>
            {oauthState === 'error' && oauthMsg && (
              <div style={{
                marginTop: 8,
                fontSize: 12, color: 'var(--red)',
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
              }}>
                ✕ {oauthMsg}
              </div>
            )}
            {oauthState === 'ok' && (
              <StatusLine status="ok" message={oauthMsg} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Re-auth screen ────────────────────────────────────────────────

export function ReauthScreen({ clientId, saveToken, setAuthState }) {
  const [state, setState] = useState('idle') // idle|pending|error
  const [msg, setMsg]     = useState('')

  const signIn = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      setMsg('Google sign-in is not available yet. Please refresh the page.')
      setState('error')
      return
    }
    setState('pending')
    setMsg('')

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          setState('error')
          setMsg('Sign in failed. Please try again.')
          return
        }
        saveToken(resp.access_token, resp.expires_in || 3600)
        setAuthState('ready')
      },
      error_callback: () => {
        setState('error')
        setMsg('Sign in was cancelled. Please try again.')
      },
    })
    client.requestAccessToken()
  }, [clientId, saveToken, setAuthState])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 14,
        padding: '36px 40px',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
          Your Google session has expired
        </p>
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 24px', lineHeight: 1.6 }}>
          Sign in again to continue. Your sheet binding is still saved.
        </p>
        <Button variant="primary" size="md" onClick={signIn} disabled={state === 'pending'}>
          {state === 'pending' ? 'Signing in…' : 'Sign in with Google'}
        </Button>
        {msg && (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--red)' }}>{msg}</p>
        )}
      </div>
    </div>
  )
}
