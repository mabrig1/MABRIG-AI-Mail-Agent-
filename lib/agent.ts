export type AgentKind = 'triage' | 'reply' | 'campaign' | 'deliverability' | 'operator'

const SYSTEM_PROMPTS: Record<AgentKind, string> = {
  triage: 'You are the MABRIG Inbox Triage Agent. Summarise the message, estimate urgency, extract requested actions, deadlines and risks. Never claim to have sent or changed email.',
  reply: 'You are the MABRIG Reply and Compose Agent. Draft a clear reply or new email. Preserve facts from the supplied text and flag any detail that needs human confirmation. Never send email.',
  campaign: 'You are the MABRIG Campaign Coach. Produce a practical campaign plan with audience, offer, subject options, body structure, CTA, segmentation and measurement. Avoid deceptive or spammy tactics.',
  deliverability: 'You are the MABRIG Deliverability Guardian. Diagnose likely delivery problems using only supplied evidence. Separate confirmed facts from checks still required. Cover SPF, DKIM, DMARC, PTR/rDNS, reputation, list hygiene and content when relevant.',
  operator: 'You are the MABRIG Mail-Server Operator. Explain likely server issues and propose the smallest safe diagnostic steps. Do not claim commands were run. Treat destructive actions as requiring explicit human approval.',
}

function fallback(kind: AgentKind, input: string) {
  const preview = input.trim().slice(0, 700)
  const titles: Record<AgentKind, string> = {
    triage: 'Inbox triage',
    reply: 'Reply draft',
    campaign: 'Campaign plan',
    deliverability: 'Deliverability diagnosis',
    operator: 'Server operations note',
  }

  return `${titles[kind]}\n\nAI provider is not configured yet. The request was received safely in draft-only mode.\n\nInput preview:\n${preview}\n\nNext: configure AI_GATEWAY_URL, AI_GATEWAY_API_KEY and AI_MODEL to enable model-generated output.`
}

export async function runAgent(kind: AgentKind, input: string) {
  const gateway = process.env.AI_GATEWAY_URL?.replace(/\/$/, '')
  const apiKey = process.env.AI_GATEWAY_API_KEY
  const model = process.env.AI_MODEL

  if (!gateway || !apiKey || !model) return fallback(kind, input)

  const response = await fetch(`${gateway}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[kind] },
        { role: 'user', content: input },
      ],
      temperature: 0.3,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`AI provider returned HTTP ${response.status}`)
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const output = data.choices?.[0]?.message?.content?.trim()
  if (!output) throw new Error('AI provider returned an empty response')
  return output
}
