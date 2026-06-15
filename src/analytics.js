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
