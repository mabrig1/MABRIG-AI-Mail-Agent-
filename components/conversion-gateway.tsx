'use client'

import { useCallback, useEffect, useState } from 'react'

type ConversionEvent = {
  _id: string
  provider?: string
  eventKey?: string
  type?: string
  reference?: string
  source?: string
  product?: string
  amount?: number
  currency?: string
  campaignId?: string
  providerVerified?: boolean
  status?: string
  attempts?: number
  receivedAt?: string
  processedAt?: string
  lastError?: string
}

type NetworkSource = {
  sourceApp: string
  events: number
  purchases: number
  quoteRequests: number
  directAttributedEvents: number
  purchaseValueByCurrency: Record<string, number>
  lastEventAt?: string | null
}

type GatewayPayload = {
  configured?: boolean
  integrations?: {
    generic?: boolean
    paystack?: boolean
    flutterwave?: boolean
  }
  endpoints?: {
    generic?: string
    paystack?: string
    flutterwave?: string
  }
  events?: ConversionEvent[]
  network?: NetworkSource[]
}

export function ConversionGateway() {
  const [payload, setPayload] = useState<GatewayPayload>({})
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/conversions/status')
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(data.error ?? 'Could not load Conversion Gateway status.')
      return
    }
    setPayload(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const events = payload.events ?? []
  const network = payload.network ?? []

  function valueLabel(values: Record<string, number>) {
    const entries = Object.entries(values)
    if (!entries.length) return 'No recorded purchase value'
    return entries
      .map(([currency, value]) => `${currency} ${Number(value).toLocaleString()}`)
      .join(' · ')
  }

  const integrations = [
    ['Generic HMAC', payload.integrations?.generic, payload.endpoints?.generic],
    ['Paystack', payload.integrations?.paystack, payload.endpoints?.paystack],
    ['Flutterwave', payload.integrations?.flutterwave, payload.endpoints?.flutterwave],
  ] as const

  return (
    <section className="architecture conversion-gateway">
      <div className="console-head">
        <div>
          <p className="eyebrow">CONVERSION GATEWAY</p>
          <h2>Automatic business outcome ingestion</h2>
        </div>
        <button type="button" className="ghost-button" onClick={() => load()}>
          Refresh gateway
        </button>
      </div>

      {payload.configured === false && (
        <p className="empty-note">
          MongoDB is required before signed payment and website conversion events can be persisted.
        </p>
      )}

      <div className="integration-grid">
        {integrations.map(([name, ready, endpoint]) => (
          <article className="integration-card" key={name}>
            <div className="integration-head">
              <strong>{name}</strong>
              <span className={ready ? 'integration-state ready' : 'integration-state'}>
                {ready ? 'Configured' : 'Needs secret'}
              </span>
            </div>
            <code>{endpoint || 'Endpoint available after configuration'}</code>
          </article>
        ))}
      </div>

      {network.length > 0 && (
        <div className="source-network-grid">
          {network.map(source => (
            <article className="source-network-card" key={source.sourceApp}>
              <p className="eyebrow">CONNECTED SOURCE</p>
              <h3>{source.sourceApp}</h3>
              <p>
                <strong>{source.events}</strong> events · <strong>{source.purchases}</strong> purchases · <strong>{source.quoteRequests}</strong> quote requests
              </p>
              <p>{valueLabel(source.purchaseValueByCurrency)}</p>
              <p>
                <strong>{source.directAttributedEvents}</strong> directly attributed event(s)
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="conversion-guidance">
        <p>
          Payment events can create a customer lifecycle record and attributed purchase, but they do not grant marketing consent.
          For direct campaign attribution, pass the Growth Journey ID or <code>bm:&lt;taskId&gt;</code> in your checkout metadata.
        </p>
      </div>

      <div className="conversion-table-wrap">
        <table className="conversion-table">
          <thead>
            <tr>
              <th>Source app</th>
              <th>Provider</th>
              <th>Type</th>
              <th>Status</th>
              <th>Product / value</th>
              <th>Reference</th>
              <th>Campaign</th>
              <th>Verified</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {(payload.events ?? []).length === 0 ? (
              <tr>
                <td colSpan={9}>No conversion events recorded yet.</td>
              </tr>
            ) : (
              (payload.events ?? []).map(event => (
                <tr key={event._id}>
                  <td><strong>{event.source?.split(':')[0] || event.provider || '—'}</strong><small>{event.source || ''}</small></td>
                  <td>{event.provider || '—'}</td>
                  <td>{event.type?.replaceAll('_', ' ') || '—'}</td>
                  <td>
                    <span className={"conversion-status " + (event.status || '')}>
                      {event.status || 'unknown'}
                    </span>
                    {event.lastError && <small>{event.lastError}</small>}
                  </td>
                  <td>
                    <span>{event.product || '—'}</span>
                    {typeof event.amount === 'number' && (
                      <small>{event.currency || ''} {event.amount.toLocaleString()}</small>
                    )}
                  </td>
                  <td>{event.reference || event.eventKey || '—'}</td>
                  <td><code>{event.campaignId || '—'}</code></td>
                  <td>{event.providerVerified ? 'Yes' : 'No'}</td>
                  <td>{event.attempts ?? 1}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
