import { useState, useCallback, useEffect } from 'react'

const CONFIG_KEY = 'timeline-tracker-config'
const TOKEN_KEY  = 'timeline-tracker-token'

export function getStoredConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') } catch { return null }
}

function getStoredToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') } catch { return null }
}

function isTokenValid(tok) {
  return tok && tok.accessToken && tok.expiresAt && Date.now() < tok.expiresAt - 60_000
}

// Wait for the GIS script to finish loading (it's loaded without defer/async block)
function waitForGIS(timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(true); return }
    const start = Date.now()
    const id = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(id); resolve(true); return }
      if (Date.now() - start > timeoutMs) { clearInterval(id); resolve(false) }
    }, 50)
  })
}

// Attempt a silent token refresh — resolves with access token string or null
export async function trySilentRefresh(clientId) {
  const loaded = await waitForGIS()
  if (!loaded) return null

  return new Promise((resolve) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets email profile',
        prompt: '',
        callback: (resp) => {
          if (resp.error || !resp.access_token) { resolve(null); return }
          resolve(resp.access_token)
        },
        error_callback: () => resolve(null),
      })
      client.requestAccessToken()
    } catch {
      resolve(null)
    }
  })
}

export function useSheetConfig() {
  const [config, setConfig]     = useState(getStoredConfig)
  const [authState, setAuthState] = useState('loading') // 'loading'|'onboarding'|'reauth'|'ready'

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  // On mount: decide initial auth state
  useEffect(() => {
    async function init() {
      const cfg = getStoredConfig()
      if (!cfg) { setAuthState('onboarding'); return }

      const tok = getStoredToken()
      if (isTokenValid(tok)) { setAuthState('ready'); return }

      // Token missing or expired — try silent refresh
      const newToken = await trySilentRefresh(clientId)
      if (newToken) {
        saveToken(newToken, 3600)
        setAuthState('ready')
      } else {
        setAuthState('reauth')
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = useCallback((cfg) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
    setConfig(cfg)
  }, [])

  const saveToken = useCallback((accessToken, expiresInSeconds = 3600) => {
    const tok = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tok))
    return tok
  }, [])

  // Returns a valid access token, attempting silent refresh if expired.
  // Returns null if re-auth is required (caller should handle gracefully).
  const getAccessToken = useCallback(async () => {
    const tok = getStoredToken()
    if (isTokenValid(tok)) return tok.accessToken

    const newToken = await trySilentRefresh(clientId)
    if (newToken) {
      saveToken(newToken, 3600)
      return newToken
    }

    setAuthState('reauth')
    return null
  }, [clientId, saveToken])

  // Clear everything and return to onboarding
  const clearAll = useCallback(() => {
    [CONFIG_KEY, TOKEN_KEY,
     'timeline-tracker-v3', 'timeline-tracker-pending', 'timeline-tracker-synced-at',
    ].forEach(k => localStorage.removeItem(k))
    setConfig(null)
    setAuthState('onboarding')
  }, [])

  return { config, authState, clientId, saveConfig, saveToken, getAccessToken, clearAll, setAuthState }
}
