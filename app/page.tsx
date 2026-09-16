import Link from 'next/link'

export default function Home() {
  return (
    <main className="shell landing">
      <section className="hero landing-hero">
        <div>
          <p className="eyebrow">MABRIG TECHNOLOGIES</p>
          <h1>AI-native email operations for MABRIG Mail.</h1>
          <p className="lede">
            Triage inboxes, draft replies, design campaigns, diagnose deliverability and
            supervise mail-server operations from one approval-controlled workspace.
          </p>
          <div className="landing-actions">
            <Link className="primary-link" href="/login">Admin sign in</Link>
            <Link className="secondary-link" href="/dashboard">Open control room</Link>
          </div>
        </div>
        <div className="landing-panel">
          <p className="eyebrow">AGENT TEAM</p>
          <strong>5 specialist agents</strong>
          <p>Inbox • Compose • Campaigns • Deliverability • Operations</p>
          <div className="status"><span /> External actions require human approval</div>
        </div>
      </section>
    </main>
  )
}
