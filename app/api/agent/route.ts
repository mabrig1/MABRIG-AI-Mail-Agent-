import { NextResponse } from 'next/server'
import { AgentKind, runAgent } from '@/lib/agent'

const ALLOWED = new Set<AgentKind>(['triage', 'reply', 'campaign', 'deliverability', 'operator'])

export async function POST(request: Request) {
  try {
    const body = await request.json() as { agent?: string; input?: string }
    const agent = body.agent as AgentKind
    const input = body.input?.trim() ?? ''
    const max = Number(process.env.MAX_AGENT_INPUT_CHARS ?? 12000)

    if (!ALLOWED.has(agent)) {
      return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 })
    }
    if (!input) {
      return NextResponse.json({ error: 'Input is required.' }, { status: 400 })
    }
    if (input.length > max) {
      return NextResponse.json({ error: `Input exceeds ${max} characters.` }, { status: 413 })
    }

    const output = await runAgent(agent, input)
    return NextResponse.json({ agent, output, actionMode: 'draft-only' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent request failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
