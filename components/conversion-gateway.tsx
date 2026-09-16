'use client'

import { useCallback, useEffect, useState } from 'react'

type ConversionEvent = {
  _id: string
  provider?: string
  eventKey?: string
  type?: string
  reference?: string
  campaignId?: string
  providerVerified?: boolean
  status?: string
  attempts?: number
  receivedAt?: string
  processedAt?: string
  lastError?: string
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
              <th>Provider</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reference</th>
              <th>Campaign</th>
              <th>Verified</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {(payload.events ?? []).length === 0 ? (
              <tr>
                <td colSpan={7}>No conversion events recorded yet.</td>
              </tr>
            ) : (
              (payload.events ?? []).map(event => (
                <tr key={event._id}>
                  <td>{event.provider || '—'}</td>
                  <td>{event.type?.replaceAll('_', ' ') || '—'}</td>
                  <td>
                    <span className={"conversion-status " + (event.status || '')}>
                      {event.status || 'unknown'}
                    </span>
                    {event.lastError && <small>{event.lastError}</small>}
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
