'use client'

import { FormEvent, useState } from 'react'

const agentOptions = [
  ['triage', 'Inbox Triage'],
  ['reply', 'Reply & Compose'],
  ['campaign', 'Campaign Coach'],
  ['deliverability', 'Deliverability Guardian'],
  ['operator', 'Mail-Server Operator'],
]

export function AgentConsole() {
  const [agent, setAgent] = useState('triage')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    setResult('')

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

  return (
    <section className="console">
      <div className="console-head">
        <div>
          <p className="eyebrow">LIVE AGENT WORKSPACE</p>
          <h2>Ask your mail team</h2>
        </div>
        <span className="mode">Draft-only mode</span>
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

      {result && <div className="result"><pre>{result}</pre></div>}
    </section>
  )
}
