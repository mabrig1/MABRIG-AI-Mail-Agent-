'use client'

import { FormEvent, useState } from 'react'

type GrowthPlan = {
  business: string
  promotion: string
  growth: string
  lifecycle: string
  sales: string
}

type Proposal = {
  token: string
  action: { id: string; type: string; summary: string }
}

export function BusinessGrowthStudio() {
  const [form, setForm] = useState({
    businessName: '',
    product: '',
    audience: '',
    objective: '',
    offer: '',
    market: '',
    constraints: '',
  })
  const [plan, setPlan] = useState<GrowthPlan | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  function update(name: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [name]: value }))
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    setPlan(null)
    setProposal(null)

    const response = await fetch('/api/marketing/growth-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus(payload.error ?? 'Could not generate growth plan.')
    } else {
      setPlan(payload)
    }

    setLoading(false)
  }

  async function stageCampaign() {
    if (!plan) return
    const summary = [
      `Business promotion plan for ${plan.business}`,
      '',
      'PROMOTION',
      plan.promotion,
      '',
      'GROWTH',
      plan.growth,
      '',
      'LIFECYCLE',
      plan.lifecycle,
      '',
      'SALES',
      plan.sales,
    ].join('\n')

    const response = await fetch('/api/actions/propose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'create_campaign',
        summary,
        details: {
          business: form.businessName,
          objective: form.objective,
          product: form.product,
          market: form.market,
        },
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setStatus(payload.error ?? 'Could not stage campaign.')
    else setProposal(payload)
  }

  async function approve() {
    if (!proposal?.token) return
    const response = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: proposal.token }),
    })

    const payload = await response.json().catch(() => ({}))
    setStatus(payload.message ?? payload.error ?? 'Approval processed.')
  }

  return (
    <section className="architecture growth-studio">
      <div className="console-head">
        <div>
          <p className="eyebrow">BUSINESS GROWTH OS</p>
          <h2>Promotion & revenue strategy studio</h2>
        </div>
        <span className="mode">Goal → offer → journey → next action</span>
      </div>

      <form className="growth-form" onSubmit={generate}>
        <input value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="Business name" required />
        <input value={form.product} onChange={e => update('product', e.target.value)} placeholder="Product or service" required />
        <input value={form.audience} onChange={e => update('audience', e.target.value)} placeholder="Target audience" />
        <input value={form.objective} onChange={e => update('objective', e.target.value)} placeholder="Business objective: e.g. generate 30 qualified enquiries" required />
        <input value={form.offer} onChange={e => update('offer', e.target.value)} placeholder="Current offer or promotion" />
        <input value={form.market} onChange={e => update('market', e.target.value)} placeholder="Market/location" />
        <textarea value={form.constraints} onChange={e => update('constraints', e.target.value)} placeholder="Budget, timing, brand, compliance, or operational constraints" rows={4} />
        <button type="submit" disabled={loading}>
          {loading ? 'Building growth system…' : 'Generate growth system'}
        </button>
      </form>

      {plan && (
        <>
          <div className="growth-output-grid">
            <article>
              <p className="eyebrow">PROMOTION STRATEGIST</p>
              <pre>{plan.promotion}</pre>
            </article>
            <article>
              <p className="eyebrow">GROWTH INTELLIGENCE</p>
              <pre>{plan.growth}</pre>
            </article>
            <article>
              <p className="eyebrow">LIFECYCLE ARCHITECT</p>
              <pre>{plan.lifecycle}</pre>
            </article>
            <article>
              <p className="eyebrow">SALES OPPORTUNITY</p>
              <pre>{plan.sales}</pre>
            </article>
          </div>

          <div className="approval-bar">
            <div>
              <p className="eyebrow">BUSINESS ACTION GATE</p>
              <strong>Turn this growth plan into a campaign proposal</strong>
            </div>
            <button type="button" onClick={stageCampaign}>Stage campaign</button>
          </div>
        </>
      )}

      {proposal && (
        <div className="proposal-card">
          <div>
            <p className="eyebrow">CAMPAIGN APPROVAL</p>
            <strong>create campaign</strong>
            <p>Proposal {proposal.action.id.slice(0, 8)} is signed and awaits administrator approval.</p>
          </div>
          <button type="button" onClick={approve}>Approve campaign plan</button>
        </div>
      )}

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
