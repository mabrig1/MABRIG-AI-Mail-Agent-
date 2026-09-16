import { AgentConsole } from '@/components/agent-console'

const agents = [
  ['Inbox Triage', 'Prioritise, summarise and route incoming mail.'],
  ['Reply & Compose', 'Draft replies while keeping humans in control of sending.'],
  ['Campaign Coach', 'Turn a goal into segments, subject lines and campaign copy.'],
  ['Deliverability Guardian', 'Diagnose SPF, DKIM, DMARC, reputation and content risks.'],
  ['Mail-Server Operator', 'Explain server state and propose safe operational actions.'],
]

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MABRIG TECHNOLOGIES</p>
          <h1>MABRIG AI Mail Agent</h1>
          <p className="lede">
            One control room for intelligent email operations across inboxes, campaigns,
            deliverability and the MABRIG Mail server.
          </p>
        </div>
        <div className="status"><span /> Human approval required before external actions</div>
      </section>

      <section className="grid">
        {agents.map(([name, description]) => (
          <article className="card" key={name}>
            <h2>{name}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <AgentConsole />

      <section className="architecture">
        <h2>Production architecture</h2>
        <div className="pipeline">
          <span>Inbox / Campaign</span><b>→</b><span>Agent Router</span><b>→</b>
          <span>Approval Gate</span><b>→</b><span>MABRIG Mail</span>
        </div>
        <p>
          The AI layer never needs direct SMTP credentials. Mail-server access stays behind
          a server-side bridge and can be restricted to the minimum actions required.
        </p>
      </section>
    </main>
  )
}
