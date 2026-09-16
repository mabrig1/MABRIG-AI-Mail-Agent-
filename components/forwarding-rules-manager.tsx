'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'

type Rule = {
  address: string
  goto: string
  domain: string
  create_time: number
  update_time: number
  active: number
}

type Proposal = {
  token: string
  action: {
    id: string
    type: string
    summary: string
    details?: Record<string, string>
  }
}

export function ForwardingRulesManager() {
  const [rules, setRules] = useState<Rule[]>([])
  const [address, setAddress] = useState('')
  const [goto, setGoto] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [status, setStatus] = useState('')
  const [loadingRules, setLoadingRules] = useState(false)
  const [working, setWorking] = useState(false)

  const loadRules = useCallback(async () => {
    setLoadingRules(true)
    const response = await fetch('/api/forwarding/rules')
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setStatus(payload.error ?? 'Could not load forwarding rules.')
      setRules([])
    } else {
      setRules(payload.rules ?? [])
      setStatus('')
    }
    setLoadingRules(false)
  }, [])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  async function createProposal(
    type: 'create_forward_rule' | 'edit_forward_rule' | 'delete_forward_rule',
    summary: string,
    details: Record<string, string>,
  ) {
    setWorking(true)
    setStatus('')
    const response = await fetch('/api/actions/propose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, summary, details }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setStatus(payload.error ?? 'Could not create approval request.')
      setProposal(null)
    } else {
      setProposal(payload)
    }
    setWorking(false)
  }

  async function proposeCreate(event: FormEvent) {
    event.preventDefault()
    if (!address.trim() || !goto.trim()) return

    let summary = `Create forwarding rule ${address.trim()} → ${goto.trim()}`
    try {
      const agentResponse = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agent: 'routing',
          input: [
            `Source address: ${address.trim()}`,
            `Destination(s): ${goto.trim()}`,
            'Review this recurring forwarding rule for privacy, loop and routing risks.',
          ].join('\n'),
        }),
      })
      const agentPayload = await agentResponse.json()
      if (agentResponse.ok && agentPayload.output) summary = agentPayload.output
    } catch {
      // The deterministic server-side policy still validates the rule during execution.
    }

    await createProposal('create_forward_rule', summary, {
      address: address.trim(),
      goto: goto.trim(),
      active: '1',
    })
  }

  async function stageToggle(rule: Rule) {
    const nextActive = rule.active ? '0' : '1'
    await createProposal(
      'edit_forward_rule',
      `${nextActive === '1' ? 'Enable' : 'Disable'} forwarding rule for ${rule.address}.`,
      {
        address: rule.address,
        active: nextActive,
      },
    )
  }

  async function stageDelete(rule: Rule) {
    await createProposal(
      'delete_forward_rule',
      `Delete forwarding rule for ${rule.address} currently targeting ${rule.goto}.`,
      { address: rule.address },
    )
  }

  async function approve() {
    if (!proposal?.token) return
    setWorking(true)
    const response = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: proposal.token }),
    })
    const payload = await response.json().catch(() => ({}))
    setStatus(payload.message ?? payload.error ?? 'Approval processed.')

    if (response.ok && payload.executed) {
      setProposal(null)
      setAddress('')
      setGoto('')
      await loadRules()
    }
    setWorking(false)
  }

  return (
    <section className="architecture">
      <div className="console-head">
        <div>
          <p className="eyebrow">FORWARDING RULE CONTROL</p>
          <h2>Active forwarding routes</h2>
        </div>
        <button className="ghost-button" type="button" onClick={loadRules} disabled={loadingRules}>
          {loadingRules ? 'Refreshing…' : 'Refresh rules'}
        </button>
      </div>

      <form className="rule-form" onSubmit={proposeCreate}>
        <input
          type="email"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Source mailbox: support@mabrigmail.online"
          required
        />
        <textarea
          rows={3}
          value={goto}
          onChange={(event) => setGoto(event.target.value)}
          placeholder="Destination address(es), separated by commas or new lines"
          required
        />
        <button type="submit" disabled={working || !address.trim() || !goto.trim()}>
          Review & stage rule
        </button>
      </form>

      <div className="rules-list">
        {rules.length === 0 && !loadingRules ? (
          <p className="empty-note">No forwarding rules are available from the configured mail server.</p>
        ) : (
          rules.map(rule => (
            <article className="rule-row" key={rule.address}>
              <div>
                <strong>{rule.address}</strong>
                <p>→ {rule.goto}</p>
              </div>
              <span className={rule.active ? 'rule-state active' : 'rule-state'}>
                {rule.active ? 'Enabled' : 'Disabled'}
              </span>
              <button className="ghost-button" type="button" onClick={() => stageToggle(rule)}>
                {rule.active ? 'Disable' : 'Enable'}
              </button>
              <button className="danger-button" type="button" onClick={() => stageDelete(rule)}>
                Delete
              </button>
            </article>
          ))
        )}
      </div>

      {proposal && (
        <div className="proposal-card">
          <div>
            <p className="eyebrow">SIGNED ADMIN APPROVAL</p>
            <strong>{proposal.action.type.replaceAll('_', ' ')}</strong>
            <p>{proposal.action.summary}</p>
          </div>
          <button type="button" disabled={working} onClick={approve}>
            {working ? 'Processing…' : 'Approve & execute'}
          </button>
        </div>
      )}

      {status && <p className="approval-message">{status}</p>}
    </section>
  )
}
