'use client'

import { FormEvent, useState } from 'react'

const signalLabels = [
  ['openedRecentEmail', 'Opened a recent email'],
  ['clickedRecentEmail', 'Clicked a recent email'],
  ['replied', 'Replied directly'],
  ['requestedQuote', 'Requested a quote / offer'],
  ['visitedPricing', 'Visited pricing / offer page'],
  ['existingCustomer', 'Existing customer'],
  ['lapsedCustomer', 'Lapsed customer'],
] as const

type SignalKey = typeof signalLabels[number][0]

type Result = {
  persisted?: boolean
  persistenceWarning?: string
  assessment: {
    score: number
    band: string
    reasons: string[]
    nextBestAction: string
  }
  recommendation: string
}

export function LeadIntelligence() {
  const [leadLabel, setLeadLabel] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [context, setContext] = useState('')
  const [days, setDays] = useState('0')
  const [signals, setSignals] = useState<Record<SignalKey, boolean>>({
    openedRecentEmail: false,
    clickedRecentEmail: false,
    replied: false,
    requestedQuote: false,
    visitedPricing: false,
    existingCustomer: false,
    lapsedCustomer: false,
  })
  const [result, setResult] = useState<Result | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    setResult(null)

    const response = await fetch('/api/marketing/lead-score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadLabel,
        contactEmail,
        context,
        signals: {
          ...signals,
          daysSinceLastEngagement: Number(days || 0),
        },
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setStatus(payload.error ?? 'Could not assess lead.')
    else setResult(payload)
    setLoading(false)
  }

  return (
    <section className="architecture lead-intelligence">
      <div className="console-head">
        <div>
          <p className="eyebrow">LEAD INTELLIGENCE</p>
          <h2>Opportunity score & next-best action</h2>
        </div>
        <span className="mode">Transparent scoring</span>
      </div>

      <form className="lead-form" onSubmit={submit}>
        <input value={leadLabel} onChange={e => setLeadLabel(e.target.value)} placeholder="Lead / account label" />
        <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Contact email (optional, saves to Growth Graph)" />
        <input type="number" min="0" value={days} onChange={e => setDays(e.target.value)} placeholder="Days since last engagement" />
        <textarea value={context} onChange={e => setContext(e.target.value)} placeholder="What do you know from legitimate business interactions?" rows={4} />
        <div className="signal-grid">
          {signalLabels.map(([key, label]) => (
            <label key={key} className="signal-option">
              <input
                type="checkbox"
                checked={signals[key]}
                onChange={e => setSignals(current => ({ ...current, [key]: e.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Assessing…' : 'Assess opportunity'}</button>
      </form>

      {result && (
        <div className="lead-result">
          <div className="score-orb">
            <strong>{result.assessment.score}</strong>
            <span>/100</span>
          </div>
          <div>
            <p className="eyebrow">SIGNAL BAND</p>
            <h3>{result.assessment.band.replace('-', ' ')}</h3>
            <p>{result.assessment.nextBestAction}</p>
            <ul>
              {result.assessment.reasons.map(reason => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
          <article className="lead-ai-note">
            <p className="eyebrow">AI NEXT-BEST ACTION</p>
            <pre>{result.recommendation}</pre>
            {result.persisted && <p className="persist-note">Saved to Opportunity Radar.</p>}
            {result.persistenceWarning && <p className="persist-note">Persistence warning: {result.persistenceWarning}</p>}
          </article>
        </div>
      )}

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
