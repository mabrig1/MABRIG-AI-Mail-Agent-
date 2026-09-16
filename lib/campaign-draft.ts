import { createHash } from 'crypto'
import { runAgent } from '@/lib/agent'

export type CampaignDraft = {
  subject: string
  preheader: string
  bodyText: string
  ctaText: string
  ctaUrl?: string
  html: string
  digest: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function firstMatch(text: string, label: string, nextLabel?: string) {
  const start = text.indexOf(label)
  if (start < 0) return ''
  const from = start + label.length
  const end = nextLabel ? text.indexOf(nextLabel, from) : -1
  return text.slice(from, end >= 0 ? end : undefined).trim()
}

function safeLine(value: string, fallback: string, max = 180) {
  return (value || fallback).replace(/\s+/g, ' ').trim().slice(0, max)
}

function renderHtml(draft: {
  preheader: string
  bodyText: string
  ctaText: string
  ctaUrl?: string
}) {
  const paragraphs = draft.bodyText
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map(paragraph => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(paragraph)}</p>`)
    .join('')

  return [
    '<!doctype html>',
    '<html><body style="font-family:Arial,sans-serif;color:#17202a;background:#ffffff;">',
    `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(draft.preheader)}</div>`,
    '<div style="max-width:640px;margin:0 auto;padding:24px;">',
    paragraphs,
    draft.ctaUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(draft.ctaUrl)}" style="display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700">${escapeHtml(draft.ctaText)}</a></p>`
      : `<p style="margin:24px 0 0;font-weight:700">${escapeHtml(draft.ctaText)}</p>`,
    '<p style="margin:28px 0 0;font-size:12px;color:#6b7280">You are receiving this because you previously gave permission to receive marketing messages. You can unsubscribe using the link provided by the mail platform.</p>',
    '</div></body></html>',
  ].join('')
}

export async function composeCampaignDraft(input: {
  title: string
  objective: string
  segmentLabel: string
  segmentDefinition: string
  plan: string
  ctaUrl?: string
}) {
  const prompt = [
    `Campaign title: ${input.title}`,
    `Objective: ${input.objective}`,
    `Audience segment: ${input.segmentLabel}`,
    `Segment definition: ${input.segmentDefinition}`,
    '',
    'Journey strategy:',
    input.plan,
    '',
    'Write the first campaign email in plain text using exactly these labels:',
    'SUBJECT:',
    'PREHEADER:',
    'BODY:',
    'CTA:',
    '',
    'Rules:',
    '- Do not invent discounts, testimonials, prices, deadlines, statistics, or guarantees.',
    '- Do not use deceptive urgency.',
    '- Keep BODY under 450 words.',
    '- CTA should be one short sentence.',
    '- Do not include recipient names or private attributes.',
  ].join('\n')

  let output = ''
  try {
    output = await runAgent('campaign', prompt)
  } catch {
    output = ''
  }

  const subject = safeLine(
    firstMatch(output, 'SUBJECT:', 'PREHEADER:'),
    input.title,
    180,
  )
  const preheader = safeLine(
    firstMatch(output, 'PREHEADER:', 'BODY:'),
    input.objective,
    220,
  )
  const bodyText = (
    firstMatch(output, 'BODY:', 'CTA:') ||
    [
      input.objective,
      '',
      input.plan.slice(0, 1800),
    ].join('\n')
  ).trim().slice(0, 5000)
  const ctaText = safeLine(
    firstMatch(output, 'CTA:'),
    'Reply or use the normal business contact channel if you would like to continue.',
    240,
  )

  const ctaUrl = input.ctaUrl?.trim()
  const html = renderHtml({ preheader, bodyText, ctaText, ctaUrl })
  const digest = createHash('sha256')
    .update(JSON.stringify({ subject, preheader, bodyText, ctaText, ctaUrl, html }))
    .digest('hex')

  return {
    subject,
    preheader,
    bodyText,
    ctaText,
    ctaUrl,
    html,
    digest,
  } satisfies CampaignDraft
}
