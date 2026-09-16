'use client'

import { FormEvent, useState } from 'react'

const agentOptions = [
  ['triage', 'Inbox Triage'],
  ['reply', 'Reply & Compose'],
  ['campaign', 'Campaign Coach'],
  ['deliverability', 'Deliverability Guardian'],
  ['operator', 'Mail-Server Operator'],
  ['forward', 'Email Forwarding Agent'],
  ['routing', 'Forwarding Rule Planner'],
  ['promotion', 'Business Promotion Strategist'],
  ['growth', 'Growth Intelligence Agent'],
  ['lifecycle', 'Lifecycle Journey Architect'],
  ['sales', 'Sales Opportunity Agent'],
]

const actionOptions = [
  ['send_email', 'Send email'],
  ['create_campaign', 'Create campaign'],
  ['create_mailbox', 'Create mailbox'],
  ['change_mail_setting', 'Change mail setting'],
]

type Proposal = {
  token: string
  action: { id: string; type: string; summary: string; expiresAt: number }
  status: string
}

export function AgentConsole() {
  const [agent, setAgent] = useState('triage')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionType, setActionType] = useState('send_email')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [approvalMessage, setApprovalMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setResult('')
    setProposal(null)
    setApprovalMessage('')

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent, input }),
      })
      const payload = await response.json()
      setResult(payload.output ?? payload.error ?? 'No response returned.')
    } catch {
      setResult('The agent service could not be reached.')
    } finally {
      setLoading(false)
    }
  }

  async function createProposal() {
    if (!result) return
    setApprovalMessage('')
    const response = await fetch('/api/actions/propose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: actionType, summary: result }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setApprovalMessage(payload.error ?? 'Could not create approval request.')
      return
    }
    setProposal(payload)
  }

  async function approveProposal() {
    if (!proposal?.token) return
    const response = await fetch('/api/actions/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: proposal.token }),
    })
    const payload = await response.json()
    setApprovalMessage(payload.message ?? payload.error ?? 'Approval processed.')
  }

  return (
    <section className="console">
      <div className="console-head">
        <div>
          <p className="eyebrow">LIVE AGENT WORKSPACE</p>
          <h2>Ask your mail team</h2>
        </div>
        <span className="mode">Approval-controlled mode</span>
      </div>

      <form onSubmit={submit}>
        <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agent">
          {agentOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste an email, describe a campaign, or explain a deliverability/server issue..."
          rows={8}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? 'Working…' : 'Run agent'}
        </button>
      </form>

      {result && (
        <>
          <div className="result"><pre>{result}</pre></div>
          <div className="approval-bar">
            <div>
              <p className="eyebrow">ACTION GATE</p>
              <strong>Convert this result into an approval request</strong>
            </div>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} aria-label="Action type">
              {actionOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <button type="button" onClick={createProposal}>Create approval</button>
          </div>
        </>
      )}

      {proposal && (
        <div className="proposal-card">
          <div>
            <p className="eyebrow">AWAITING HUMAN APPROVAL</p>
            <strong>{proposal.action.type.replaceAll('_', ' ')}</strong>
            <p>Proposal {proposal.action.id.slice(0, 8)} • signed token expires in 15 minutes.</p>
          </div>
          <button type="button" onClick={approveProposal}>Approve proposal</button>
        </div>
      )}

      {approvalMessage && <p className="approval-message">{approvalMessage}</p>}
    </section>
  )
}
