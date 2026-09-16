'use client'

import { FormEvent, useState } from 'react'

type Prepared = {
  analysis: string
  proposal: {
    token: string
    action: {
      id: string
      type: string
      details?: Record<string, string>
    }
  }
}

export function ForwardingStudio() {
  const [recipient, setRecipient] = useState('')
  const [purpose, setPurpose] = useState('')
  const [message, setMessage] = useState('')
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function prepare(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    setPrepared(null)

    const response = await fetch('/api/forwarding/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient, purpose, message }),
    })

    const payload = await response.json()
    if (!response.ok) setStatus(payload.error ?? 'Could not prepare forward.')
    else setPrepared(payload)

    setLoading(false)
  }

  async function approve() {
    if (!prepared?.proposal.token) return

    const response = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: prepared.proposal.token }),
    })

    const payload = await response.json()
    setStatus(payload.message ?? payload.error ?? 'Approval processed.')
  }

  return (
    <section className="architecture">
      <div className="console-head">
        <div>
          <p className="eyebrow">EMAIL FORWARDING AGENT</p>
          <h2>Prepare a safe forward</h2>
        </div>
        <span className="mode">Explicit destination required</span>
      </div>

      <form className="forward-form" onSubmit={prepare}>
        <input
          type="email"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder="Forward to: name@example.com"
          required
        />
        <input
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          placeholder="Why should this be forwarded?"
        />
        <textarea
          rows={8}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Paste the original email here..."
          required
        />
        <button disabled={loading || !recipient || !message.trim()} type="submit">
          {loading ? 'Reviewing…' : 'Prepare forward'}
        </button>
      </form>

      {prepared && (
        <div className="result">
          <pre>{prepared.analysis}</pre>
          <div className="proposal-card">
            <div>
              <p className="eyebrow">FORWARDING APPROVAL</p>
              <strong>{prepared.proposal.action.details?.recipient}</strong>
              <p>Signed proposal {prepared.proposal.action.id.slice(0, 8)}. No forwarding occurs until approved and an executor is connected.</p>
            </div>
            <button type="button" onClick={approve}>Approve forward</button>
          </div>
        </div>
      )}

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
