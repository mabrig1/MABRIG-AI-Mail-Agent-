'use client'

import { FormEvent, useState } from 'react'

type Result = {
  domain: string
  mx: Array<{ exchange: string; priority: number }>
  spf: string[]
  dmarc: string[]
  warnings: string[]
}

export function DeliverabilityChecker() {
  const [domain, setDomain] = useState('mabrigmail.online')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const response = await fetch(`/api/deliverability/check?domain=${encodeURIComponent(domain)}`)
    const payload = await response.json()

    if (!response.ok) setError(payload.error ?? 'DNS check failed.')
    else setResult(payload)

    setLoading(false)
  }

  return (
    <section className="architecture">
      <div className="console-head">
        <div>
          <p className="eyebrow">DELIVERABILITY GUARDIAN</p>
          <h2>Domain DNS health</h2>
        </div>
        <span className="mode">Read-only check</span>
      </div>

      <form className="dns-form" onSubmit={submit}>
        <input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="example.com"
          aria-label="Domain"
        />
        <button type="submit" disabled={loading || !domain.trim()}>
          {loading ? 'Checking…' : 'Check DNS'}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {result && (
        <div className="dns-results">
          <article>
            <strong>MX</strong>
            {result.mx.length
              ? result.mx.map(record => <p key={record.exchange}>{record.priority} · {record.exchange}</p>)
              : <p>Not found</p>}
          </article>
          <article>
            <strong>SPF</strong>
            {result.spf.length ? result.spf.map(record => <p key={record}>{record}</p>) : <p>Not found</p>}
          </article>
          <article>
            <strong>DMARC</strong>
            {result.dmarc.length ? result.dmarc.map(record => <p key={record}>{record}</p>) : <p>Not found</p>}
          </article>
          <article>
            <strong>Warnings</strong>
            {result.warnings.length
              ? result.warnings.map(warning => <p key={warning}>{warning}</p>)
              : <p>No basic DNS warnings detected.</p>}
          </article>
        </div>
      )}
    </section>
  )
}
