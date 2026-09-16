'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'

type Journey = {
  _id: string
  title?: string
  status?: string
  segmentLabel?: string
}

type StatusPayload = {
  configured?: boolean
  sdkPath?: string
  ttlDays?: number
  defaultCampaignUrlConfigured?: boolean
  unsignedProviderAttributionAllowed?: boolean
}

export function AttributionSdk() {
  const [status, setStatus] = useState<StatusPayload>({})
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [journeyId, setJourneyId] = useState('')
  const [url, setUrl] = useState('')
  const [result, setResult] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [statusResponse, journeysResponse] = await Promise.all([
      fetch('/api/attribution/status'),
      fetch('/api/growth/journeys?limit=50'),
    ])
    const statusPayload = await statusResponse.json().catch(() => ({}))
    const journeyPayload = await journeysResponse.json().catch(() => ({}))

    if (statusResponse.ok) setStatus(statusPayload)
    if (journeysResponse.ok) {
      const items = journeyPayload.journeys ?? []
      setJourneys(items)
      if (!journeyId && items[0]?._id) setJourneyId(items[0]._id)
    }
  }, [journeyId])

  useEffect(() => {
    void load()
  }, [load])

  async function build(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setResult('')

    const response = await fetch('/api/attribution/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ journeyId, url }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setMessage(payload.error ?? 'Could not build attributed link.')
      return
    }

    setResult(payload.attributedUrl ?? '')
    setMessage('Signed attributed link created. The browser SDK can preserve it into checkout metadata.')
  }

  const sdkSnippet = '<script src="' + (status.sdkPath || '/mabrig-attribution.js') + '" defer></script>'
  const paystackSnippet = 'metadata: window.MabrigAttribution.paystackMetadata(existingMetadata)'
  const flutterwaveSnippet = 'meta: window.MabrigAttribution.flutterwaveMeta(existingMeta)'

  return (
    <section className="architecture attribution-sdk">
      <div className="console-head">
        <div>
          <p className="eyebrow">MABRIG ATTRIBUTION SDK</p>
          <h2>Signed first-party campaign attribution</h2>
        </div>
        <span className={status.configured ? 'integration-state ready' : 'integration-state'}>
          {status.configured ? 'Signing ready' : 'Needs ATTRIBUTION_SECRET'}
        </span>
      </div>

      <div className="sdk-grid">
        <article className="sdk-card">
          <p className="eyebrow">INSTALL</p>
          <h3>Browser SDK</h3>
          <code>{sdkSnippet}</code>
          <p>
            Captures only the signed attribution token, stores it first-party, and injects it into forms.
            It does not fingerprint devices or collect hidden identity data.
          </p>
        </article>

        <article className="sdk-card">
          <p className="eyebrow">PAYSTACK</p>
          <h3>Attach checkout metadata</h3>
          <code>{paystackSnippet}</code>
          <p>Unsigned provider campaign IDs are rejected by default.</p>
        </article>

        <article className="sdk-card">
          <p className="eyebrow">FLUTTERWAVE</p>
          <h3>Attach checkout metadata</h3>
          <code>{flutterwaveSnippet}</code>
          <p>Pass the SDK output into Flutterwave's meta object when initiating payment.</p>
        </article>
      </div>

      <form className="attribution-builder" onSubmit={build}>
        <div>
          <p className="eyebrow">ATTRIBUTED LINK BUILDER</p>
          <h3>Create a signed journey URL</h3>
          <p>
            Tokens expire after {status.ttlDays ?? 30} day(s). Altering the campaign identifier invalidates the signature.
          </p>
        </div>

        <select value={journeyId} onChange={event => setJourneyId(event.target.value)} required>
          {journeys.map(journey => (
            <option key={journey._id} value={journey._id}>
              {(journey.title || journey.segmentLabel || journey._id) + ' · ' + (journey.status || 'unknown')}
            </option>
          ))}
        </select>

        <input
          type="url"
          value={url}
          onChange={event => setUrl(event.target.value)}
          placeholder="https://your-business-site.com/offer"
          required
        />
        <button type="submit" disabled={!status.configured || !journeyId}>Create signed link</button>
      </form>

      {result && (
        <div className="attribution-result">
          <p className="eyebrow">SIGNED LINK</p>
          <code>{result}</code>
        </div>
      )}

      <div className="attribution-flags">
        <span>Default campaign CTA: <strong>{status.defaultCampaignUrlConfigured ? 'Configured' : 'Not configured'}</strong></span>
        <span>Provider raw campaign IDs: <strong>{status.unsignedProviderAttributionAllowed ? 'Legacy override enabled' : 'Rejected by default'}</strong></span>
      </div>

      {message && <p className="approval-message">{message}</p>}
    </section>
  )
}
