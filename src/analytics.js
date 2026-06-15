import posthog from 'posthog-js'

const key = import.meta.env.VITE_POSTHOG_KEY

export function initAnalytics() {
  if (!key) return
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
  })
}

export function track(event, properties) {
  if (!key) return
  posthog.capture(event, properties)
}

export async function identifyUser(getAccessToken) {
  if (!key) return
  try {
    const token = await getAccessToken()
    if (!token) return
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const { email, name } = await res.json()
    if (email) posthog.identify(email, { name, email })
  } catch {
    // silently fail — analytics should never break the app
  }
}
