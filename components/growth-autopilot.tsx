'use client'

import { useCallback, useEffect, useState } from 'react'

type Journey = {
  _id: string
  title: string
  segmentKey: string
  segmentLabel: string
  segmentDefinition: string
  audienceCount: number
  objective: string
  plan: string
  status: string
  createdAt: string
}

type Approval = {
  token: string
  action: {
    id: string
    type: string
    summary: string
  }
  journeyId: string
}

export function GrowthAutopilot() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [approval, setApproval] = useState<Approval | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const loadJourneys = useCallback(async () => {
    const response = await fetch('/api/growth/journeys?limit=20')
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus(payload.error ?? 'Could not load Growth Autopilot journeys.')
      return
    }

    setConfigured(payload.configured !== false)
    setJourneys(payload.journeys ?? [])
  }, [])

  useEffect(() => {
    void loadJourneys()
  }, [loadJourneys])

  async function scan() {
    setLoading(true)
    setStatus('')
    setApproval(null)

    const response = await fetch('/api/growth/journeys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: false }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus(payload.error ?? 'Growth Autopilot scan failed.')
    } else {
      const generated = payload.generated?.length ?? 0
      const skipped = payload.skipped?.length ?? 0
      setStatus(
        generated > 0
          ? `Generated ${generated} new journey proposal(s); ${skipped} segment(s) skipped by eligibility/cooldown rules.`
          : `No new journey was needed; ${skipped} segment(s) were empty or already covered by the cooldown.`,
      )
      await loadJourneys()
    }

    setLoading(false)
  }

  async function stage(journeyId: string) {
    setLoading(true)
    setStatus('')
    setApproval(null)

    const response = await fetch('/api/growth/journeys/stage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ journeyId }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) setStatus(payload.error ?? 'Could not stage this journey.')
    else {
      setApproval(payload)
      setStatus('Journey staged. Review the signed approval request below.')
      await loadJourneys()
    }

    setLoading(false)
  }

  async function approve() {
    if (!approval?.token) return
    setLoading(true)

    const response = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: approval.token }),
    })
    const payload = await response.json().catch(() => ({}))

    setStatus(payload.message ?? payload.error ?? 'Approval processed.')
    if (response.ok) {
      setApproval(null)
      await loadJourneys()
    }
    setLoading(false)
  }

  async function dismiss(journeyId: string) {
    setLoading(true)
    setStatus('')

    const response = await fetch('/api/growth/journeys/dismiss', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ journeyId }),
    })
    const payload = await response.json().catch(() => ({}))

    setStatus(
      response.ok
        ? 'Journey dismissed. Future scans can reconsider the segment after the normal cooldown logic.'
        : payload.error ?? 'Could not dismiss journey.',
    )
    if (response.ok) await loadJourneys()
    setLoading(false)
  }

  return (
    <section className="architecture autopilot">
      <div className="console-head">
        <div>
          <p className="eyebrow">GROWTH AUTOPILOT</p>
          <h2>Detect → design → review → approve</h2>
        </div>
        <button type="button" onClick={scan} disabled={loading || configured === false}>
          {loading ? 'Working…' : 'Scan growth opportunities'}
        </button>
      </div>

      {configured === false && (
        <p className="empty-note">
          Growth Autopilot requires the persistent MongoDB Customer Growth Graph.
        </p>
      )}

      <div className="journey-list">
        {journeys.length === 0 && configured !== false ? (
          <p className="empty-note">
            No journey proposals yet. Run a scan after recording customer and engagement signals.
          </p>
        ) : (
          journeys.map(journey => (
            <article className="journey-card" key={journey._id}>
              <div className="journey-head">
                <div>
                  <p className="eyebrow">{journey.segmentLabel}</p>
                  <h3>{journey.title}</h3>
                </div>
                <span className={"journey-status " + journey.status}>
                  {journey.status.replaceAll('-', ' ')}
                </span>
              </div>

              <div className="journey-meta">
                <span><strong>{journey.audienceCount}</strong> eligible contacts</span>
                <span>{journey.segmentDefinition}</span>
              </div>

              <p><strong>Objective:</strong> {journey.objective}</p>
              <pre>{journey.plan}</pre>

              {journey.status === 'draft' && (
                <div className="journey-actions">
                  <button type="button" onClick={() => stage(journey._id)} disabled={loading}>
                    Stage for approval
                  </button>
                  <button className="ghost-button" type="button" onClick={() => dismiss(journey._id)} disabled={loading}>
                    Dismiss
                  </button>
                </div>
              )}

              {journey.status === 'approval-staged' && (
                <p className="journey-note">
                  A signed approval was created for this journey. If that browser approval token is no longer available,
                  dismiss and rescan after the cooldown or create a new draft.
                </p>
              )}

              {journey.status === 'approved-awaiting-executor' && (
                <p className="journey-note">
                  Approved by an administrator. No campaign has been sent; this journey is waiting for the verified campaign executor.
                </p>
              )}
            </article>
          ))
        )}
      </div>

      {approval && (
        <div className="proposal-card">
          <div>
            <p className="eyebrow">SIGNED GROWTH APPROVAL</p>
            <strong>{approval.action.type.replaceAll('_', ' ')}</strong>
            <p>Approval {approval.action.id.slice(0, 8)} expires in 15 minutes.</p>
          </div>
          <button type="button" onClick={approve} disabled={loading}>
            Approve growth journey
          </button>
        </div>
      )}

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
