'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'

type Segment = {
  key: string
  label: string
  count: number
  description: string
}

type Contact = {
  _id: string
  email: string
  name?: string
  company?: string
  market?: string
  lifecycleStage?: string
  marketingConsent?: boolean
}

type Opportunity = {
  _id: string
  email: string
  label?: string
  score: number
  band: string
  nextBestAction?: string
}

const interactionTypes = [
  ['email_open', 'Email open'],
  ['email_click', 'Email click'],
  ['email_reply', 'Email reply'],
  ['pricing_visit', 'Pricing visit'],
  ['quote_request', 'Quote request'],
  ['purchase', 'Purchase'],
  ['referral', 'Referral'],
  ['consent_granted', 'Consent granted'],
  ['unsubscribe', 'Unsubscribe'],
  ['note', 'Business note'],
]

export function CustomerGrowthGraph() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const [contact, setContact] = useState({
    email: '',
    name: '',
    company: '',
    market: '',
    tags: '',
    lifecycleStage: 'prospect',
    marketingConsent: false,
    consentSource: 'admin',
  })

  const [interaction, setInteraction] = useState({
    email: '',
    type: 'email_reply',
    source: 'manual',
    value: '',
    currency: 'NGN',
    product: '',
    note: '',
  })

  const refresh = useCallback(async () => {
    const [segmentsResponse, contactsResponse, opportunitiesResponse] = await Promise.all([
      fetch('/api/growth/segments'),
      fetch('/api/growth/contacts?limit=50'),
      fetch('/api/growth/opportunities?limit=10'),
    ])

    const segmentPayload = await segmentsResponse.json().catch(() => ({}))
    const contactPayload = await contactsResponse.json().catch(() => ({}))
    const opportunityPayload = await opportunitiesResponse.json().catch(() => ({}))

    if (segmentsResponse.ok) {
      setConfigured(segmentPayload.configured !== false)
      setSegments(segmentPayload.segments ?? [])
    } else {
      setConfigured(false)
      setStatus(segmentPayload.error ?? 'Could not load growth segments.')
    }

    if (contactsResponse.ok) {
      setContacts(contactPayload.contacts ?? [])
    }

    if (opportunitiesResponse.ok) {
      setOpportunities(opportunityPayload.opportunities ?? [])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function saveContact(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setStatus('')

    const response = await fetch('/api/growth/contacts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...contact,
        tags: contact.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(payload.error ?? 'Could not save contact.')
    } else {
      setStatus(payload.created ? 'Contact added to the Customer Growth Graph.' : 'Contact updated.')
      setContact(current => ({ ...current, email: '', name: '', company: '', tags: '' }))
      await refresh()
    }

    setSaving(false)
  }

  async function recordInteraction(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setStatus('')

    const payload: Record<string, unknown> = {
      email: interaction.email,
      type: interaction.type,
      source: interaction.source,
      product: interaction.product || undefined,
      note: interaction.note || undefined,
      currency: interaction.currency || undefined,
    }

    if (interaction.value.trim()) payload.value = Number(interaction.value)

    const response = await fetch('/api/growth/interactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(result.error ?? 'Could not record interaction.')
    } else {
      setStatus('Interaction recorded and growth segments refreshed.')
      setInteraction(current => ({ ...current, value: '', product: '', note: '' }))
      await refresh()
    }

    setSaving(false)
  }

  return (
    <section className="architecture growth-graph">
      <div className="console-head">
        <div>
          <p className="eyebrow">CUSTOMER GROWTH GRAPH</p>
          <h2>Persistent customer intelligence</h2>
        </div>
        <span className="mode">{configured === false ? 'MongoDB not configured' : 'Consent-aware graph'}</span>
      </div>

      {configured === false ? (
        <p className="empty-note">
          Add MONGODB_URI and MONGODB_DB_NAME to enable persistent contacts, interactions, segments,
          purchases, durable approvals and audit history.
        </p>
      ) : (
        <>
          <div className="segment-grid">
            {segments.map(segment => (
              <article className="segment-card" key={segment.key}>
                <strong>{segment.count}</strong>
                <h3>{segment.label}</h3>
                <p>{segment.description}</p>
              </article>
            ))}
          </div>

          {opportunities.length > 0 && (
            <div className="opportunity-list">
              <p className="eyebrow">OPPORTUNITY RADAR</p>
              {opportunities.map(item => (
                <article className="opportunity-row" key={item._id}>
                  <div>
                    <strong>{item.label || item.email}</strong>
                    <p>{item.email}</p>
                  </div>
                  <span className="opportunity-score">{item.score}/100</span>
                  <div>
                    <strong>{item.band.replace('-', ' ')}</strong>
                    <p>{item.nextBestAction || 'No next action recorded.'}</p>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="growth-data-grid">
            <form className="growth-data-form" onSubmit={saveContact}>
              <p className="eyebrow">ADD / UPDATE CONTACT</p>
              <input type="email" value={contact.email} onChange={e => setContact(current => ({ ...current, email: e.target.value }))} placeholder="Email" required />
              <input value={contact.name} onChange={e => setContact(current => ({ ...current, name: e.target.value }))} placeholder="Name" />
              <input value={contact.company} onChange={e => setContact(current => ({ ...current, company: e.target.value }))} placeholder="Company / business" />
              <input value={contact.market} onChange={e => setContact(current => ({ ...current, market: e.target.value }))} placeholder="Market / location" />
              <input value={contact.tags} onChange={e => setContact(current => ({ ...current, tags: e.target.value }))} placeholder="Tags, comma separated" />
              <select value={contact.lifecycleStage} onChange={e => setContact(current => ({ ...current, lifecycleStage: e.target.value }))}>
                <option value="prospect">Prospect</option>
                <option value="lead">Lead</option>
                <option value="customer">Customer</option>
                <option value="repeat-customer">Repeat customer</option>
                <option value="lapsed">Lapsed</option>
                <option value="advocate">Advocate</option>
              </select>
              <label className="signal-option">
                <input type="checkbox" checked={contact.marketingConsent} onChange={e => setContact(current => ({ ...current, marketingConsent: e.target.checked }))} />
                <span>Marketing consent is currently valid</span>
              </label>
              <button disabled={saving} type="submit">Save contact</button>
            </form>

            <form className="growth-data-form" onSubmit={recordInteraction}>
              <p className="eyebrow">RECORD BUSINESS SIGNAL</p>
              <input type="email" value={interaction.email} onChange={e => setInteraction(current => ({ ...current, email: e.target.value }))} placeholder="Existing contact email" required />
              <select value={interaction.type} onChange={e => setInteraction(current => ({ ...current, type: e.target.value }))}>
                {interactionTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <input value={interaction.source} onChange={e => setInteraction(current => ({ ...current, source: e.target.value }))} placeholder="Source: website, campaign, sales..." />
              <input value={interaction.product} onChange={e => setInteraction(current => ({ ...current, product: e.target.value }))} placeholder="Product / service" />
              <div className="money-row">
                <input type="number" min="0" step="0.01" value={interaction.value} onChange={e => setInteraction(current => ({ ...current, value: e.target.value }))} placeholder="Value" />
                <input value={interaction.currency} onChange={e => setInteraction(current => ({ ...current, currency: e.target.value }))} placeholder="NGN" />
              </div>
              <textarea rows={3} value={interaction.note} onChange={e => setInteraction(current => ({ ...current, note: e.target.value }))} placeholder="Short operational note — no passwords, tokens, or raw email bodies" />
              <button disabled={saving} type="submit">Record signal</button>
            </form>
          </div>

          <div className="contact-table-wrap">
            <table className="contact-table">
              <thead>
                <tr><th>Contact</th><th>Business</th><th>Stage</th><th>Consent</th></tr>
              </thead>
              <tbody>
                {contacts.map(item => (
                  <tr key={item._id}>
                    <td><strong>{item.name || item.email}</strong><span>{item.email}</span></td>
                    <td>{item.company || item.market || '—'}</td>
                    <td>{item.lifecycleStage || 'prospect'}</td>
                    <td>{item.marketingConsent ? 'Allowed' : 'Not allowed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
