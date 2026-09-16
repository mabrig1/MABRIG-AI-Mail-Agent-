'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

type MoneyMap = Record<string, number>

type Campaign = {
  _id: string
  title?: string
  segmentLabel?: string
  status?: string
  approvedAudienceCount?: number
  billionMail?: {
    taskId?: number
    recipientCount?: number
    scheduledStartTime?: number
  }
  economics?: {
    spend?: {
      amount?: number
      currency?: string
      note?: string
    }
  }
  campaignIntelligence?: {
    taskStatus?: string
    taskId?: number
    syncedAt?: string
    metrics?: {
      sends?: number
      delivered?: number
      opened?: number
      clicked?: number
      bounced?: number
      delivery_rate?: number
      open_rate?: number
      click_rate?: number
      bounce_rate?: number
    }
    attribution?: {
      attributionWindowDays?: number
      direct?: {
        purchases?: number
        replies?: number
        quoteRequests?: number
        referrals?: number
        revenueByCurrency?: MoneyMap
      }
      assisted?: {
        purchases?: number
        replies?: number
        quoteRequests?: number
        referrals?: number
        revenueByCurrency?: MoneyMap
      }
    }
    economics?: {
      directRoas?: {
        currency?: string
        spend?: number
        directlyAttributedRevenue?: number
        roas?: number
        revenueMinusCampaignSpend?: number
        note?: string
      } | null
    }
  }
}

function moneyMapLabel(values?: MoneyMap) {
  const entries = Object.entries(values ?? {})
  if (!entries.length) return '—'
  return entries.map(([currency, value]) => `${currency} ${Number(value).toLocaleString()}`).join(' · ')
}

function rate(value?: number) {
  return `${Number(value ?? 0).toFixed(1)}%`
}

export function CampaignIntelligence() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [spend, setSpend] = useState({
    journeyId: '',
    amount: '',
    currency: 'NGN',
    note: '',
  })

  const load = useCallback(async () => {
    const response = await fetch('/api/growth/campaign-intelligence')
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(payload.error ?? 'Could not load campaign intelligence.')
      return
    }

    setConfigured(payload.configured !== false)
    setCampaigns(payload.campaigns ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!spend.journeyId && campaigns[0]?._id) {
      setSpend(current => ({ ...current, journeyId: campaigns[0]._id }))
    }
  }, [campaigns, spend.journeyId])

  const campaignOptions = useMemo(
    () => campaigns.map(campaign => ({
      id: campaign._id,
      label: `${campaign.title || 'Campaign'} · task ${campaign.billionMail?.taskId ?? '—'}`,
    })),
    [campaigns],
  )

  async function sync(journeyId?: string) {
    setBusy(true)
    setStatus('')
    const response = await fetch('/api/growth/campaign-intelligence', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(journeyId ? { journeyId } : {}),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus(payload.error ?? 'Campaign intelligence sync failed.')
    } else {
      setStatus(
        journeyId
          ? 'Campaign metrics and attribution refreshed.'
          : `Synced ${payload.synced ?? 0} campaign(s); ${payload.failed ?? 0} failed.`,
      )
      await load()
    }
    setBusy(false)
  }

  async function saveSpend(event: FormEvent) {
    event.preventDefault()
    if (!spend.journeyId) return
    setBusy(true)
    setStatus('')

    const response = await fetch('/api/growth/campaign-intelligence/spend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        journeyId: spend.journeyId,
        amount: Number(spend.amount || 0),
        currency: spend.currency,
        note: spend.note || undefined,
      }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus(payload.error ?? 'Could not record campaign spend.')
    } else {
      setStatus('Campaign spend recorded. Direct ROAS recalculates from explicitly attributed revenue only.')
      setSpend(current => ({ ...current, amount: '', note: '' }))
      await load()
    }
    setBusy(false)
  }

  return (
    <section className="architecture campaign-intelligence">
      <div className="console-head">
        <div>
          <p className="eyebrow">CAMPAIGN INTELLIGENCE</p>
          <h2>Delivery → engagement → business outcomes</h2>
        </div>
        <button type="button" onClick={() => sync()} disabled={busy || configured === false}>
          {busy ? 'Syncing…' : 'Sync all campaigns'}
        </button>
      </div>

      {configured === false ? (
        <p className="empty-note">MongoDB is required for persistent campaign intelligence.</p>
      ) : campaigns.length === 0 ? (
        <p className="empty-note">No executed BillionMail Growth Autopilot campaigns are available yet.</p>
      ) : (
        <>
          <div className="campaign-intelligence-grid">
            {campaigns.map(campaign => {
              const intel = campaign.campaignIntelligence
              const metrics = intel?.metrics
              const direct = intel?.attribution?.direct
              const assisted = intel?.attribution?.assisted
              const roas = intel?.economics?.directRoas
              const taskId = campaign.billionMail?.taskId

              return (
                <article className="campaign-metric-card" key={campaign._id}>
                  <div className="journey-head">
                    <div>
                      <p className="eyebrow">{campaign.segmentLabel || 'GROWTH JOURNEY'}</p>
                      <h3>{campaign.title || 'Campaign'}</h3>
                    </div>
                    <span className="journey-status scheduled">
                      {intel?.taskStatus || campaign.status || 'scheduled'}
                    </span>
                  </div>

                  <p className="attribution-id">
                    Attribution IDs: <code>{campaign._id}</code> · <code>bm:{taskId ?? '—'}</code>
                  </p>

                  <div className="delivery-metrics">
                    <span><strong>{metrics?.sends ?? 0}</strong>Sends</span>
                    <span><strong>{rate(metrics?.delivery_rate)}</strong>Delivered</span>
                    <span><strong>{rate(metrics?.open_rate)}</strong>Opened</span>
                    <span><strong>{rate(metrics?.click_rate)}</strong>Clicked</span>
                    <span><strong>{rate(metrics?.bounce_rate)}</strong>Bounced</span>
                  </div>

                  <div className="attribution-columns">
                    <div>
                      <p className="eyebrow">DIRECT ATTRIBUTION</p>
                      <p><strong>{direct?.purchases ?? 0}</strong> purchases · <strong>{direct?.quoteRequests ?? 0}</strong> quotes · <strong>{direct?.replies ?? 0}</strong> replies</p>
                      <p>Revenue: <strong>{moneyMapLabel(direct?.revenueByCurrency)}</strong></p>
                    </div>
                    <div>
                      <p className="eyebrow">POST-SEND ASSISTED</p>
                      <p><strong>{assisted?.purchases ?? 0}</strong> purchases · <strong>{assisted?.quoteRequests ?? 0}</strong> quotes · <strong>{assisted?.replies ?? 0}</strong> replies</p>
                      <p>Observed revenue: <strong>{moneyMapLabel(assisted?.revenueByCurrency)}</strong></p>
                    </div>
                  </div>

                  {roas && (
                    <div className="roas-box">
                      <span>Recorded spend <strong>{roas.currency} {Number(roas.spend ?? 0).toLocaleString()}</strong></span>
                      <span>Direct revenue <strong>{roas.currency} {Number(roas.directlyAttributedRevenue ?? 0).toLocaleString()}</strong></span>
                      <span>Direct ROAS <strong>{Number(roas.roas ?? 0).toFixed(2)}×</strong></span>
                    </div>
                  )}

                  <div className="journey-actions">
                    <button type="button" onClick={() => sync(campaign._id)} disabled={busy}>
                      Refresh this campaign
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          <form className="campaign-spend-form" onSubmit={saveSpend}>
            <div>
              <p className="eyebrow">CAMPAIGN SPEND</p>
              <h3>Record actual spend for direct ROAS</h3>
              <p>ROAS uses explicit campaign-attributed revenue only; assisted revenue is never counted as direct return.</p>
            </div>
            <select value={spend.journeyId} onChange={e => setSpend(current => ({ ...current, journeyId: e.target.value }))} required>
              {campaignOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={spend.amount} onChange={e => setSpend(current => ({ ...current, amount: e.target.value }))} placeholder="Spend amount" required />
            <input value={spend.currency} onChange={e => setSpend(current => ({ ...current, currency: e.target.value.toUpperCase() }))} placeholder="NGN" required />
            <input value={spend.note} onChange={e => setSpend(current => ({ ...current, note: e.target.value }))} placeholder="Optional spend note" />
            <button type="submit" disabled={busy}>Save spend</button>
          </form>
        </>
      )}

      <p className="intelligence-disclaimer">
        Direct attribution requires an event campaignId matching the journey ID or BillionMail task ID. Assisted signals are time-window observations from the approved cohort and are not presented as proof of causation.
      </p>

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
