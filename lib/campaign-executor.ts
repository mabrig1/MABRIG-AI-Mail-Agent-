import { createHash } from 'crypto'
import type { ProposedAction } from '@/lib/approval'
import {
  createContactGroup,
  createEmailTemplate,
  createMarketingTask,
  deleteContactGroup,
  deleteEmailTemplate,
  importContactsToGroup,
} from '@/lib/billionmail'
import { checkDeliverability } from '@/lib/deliverability'
import { getGrowthJourney, updateGrowthJourneyStatus } from '@/lib/growth-autopilot'
import { getSegmentRecipients } from '@/lib/growth-graph'

function hashRecipient(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

function campaignSettings() {
  const sender = process.env.CAMPAIGN_SENDER?.trim() || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
    throw new Error('CAMPAIGN_SENDER must be a valid email address.')
  }

  const maxRecipients = Math.max(Number(process.env.CAMPAIGN_MAX_RECIPIENTS ?? 1000), 1)
  const threads = Math.min(Math.max(Number(process.env.CAMPAIGN_THREADS ?? 2), 1), 20)
  const startDelay = Math.max(Number(process.env.CAMPAIGN_START_DELAY_SECONDS ?? 300), 60)

  return {
    sender,
    senderName: process.env.CAMPAIGN_SENDER_NAME?.trim() || '',
    maxRecipients,
    threads,
    startDelay,
    warmup: process.env.CAMPAIGN_WARMUP === 'false' ? 0 : 1,
    trackOpen: process.env.CAMPAIGN_TRACK_OPEN === 'false' ? 0 : 1,
    trackClick: process.env.CAMPAIGN_TRACK_CLICK === 'false' ? 0 : 1,
    requireDnsPass: process.env.CAMPAIGN_REQUIRE_DNS_PASS !== 'false',
  }
}

async function checkSenderDns(sender: string, requirePass: boolean) {
  const domain = sender.split('@')[1]
  const result = await checkDeliverability(domain)

  if (requirePass && result.warnings.length) {
    throw new Error(
      `Campaign sender DNS preflight failed: ${result.warnings.join(' ')}`,
    )
  }

  return result
}

export async function executeGrowthCampaign(action: ProposedAction) {
  if (action.type !== 'create_campaign' || !action.details?.journeyId) {
    throw new Error('Growth campaign executor requires a journey-backed create_campaign action.')
  }

  const journey = await getGrowthJourney(action.details.journeyId)
  if (!journey) throw new Error('Growth journey was not found.')

  if (journey.status !== 'approval-staged') {
    throw new Error('Growth journey is not in approval-staged state.')
  }

  const campaignDraft = journey.campaignDraft as {
    subject?: string
    html?: string
    digest?: string
  } | undefined

  if (!campaignDraft?.subject || !campaignDraft.html || !campaignDraft.digest) {
    throw new Error('Approved campaign draft is missing.')
  }

  if (campaignDraft.digest !== action.details.campaignDigest) {
    throw new Error('Campaign copy changed after approval staging.')
  }

  if (String(journey.approvedAudienceFingerprint || '') !== action.details.audienceFingerprint) {
    throw new Error('Approved audience fingerprint no longer matches the signed action.')
  }

  const approvedHashes = new Set(
    Array.isArray(journey.approvedRecipientHashes)
      ? journey.approvedRecipientHashes.map(value => String(value))
      : [],
  )

  if (!approvedHashes.size) throw new Error('Approved audience snapshot is missing.')

  const currentRecipients = await getSegmentRecipients(String(journey.segmentKey || ''))
  const recipients = currentRecipients.filter(email => approvedHashes.has(hashRecipient(email)))

  if (!recipients.length) {
    throw new Error('No approved recipients remain eligible after current consent checks.')
  }

  const settings = campaignSettings()
  if (recipients.length > settings.maxRecipients) {
    throw new Error(
      `Current approved audience (${recipients.length}) exceeds CAMPAIGN_MAX_RECIPIENTS (${settings.maxRecipients}).`,
    )
  }

  const dns = await checkSenderDns(settings.sender, settings.requireDnsPass)

  const suffix = `${action.id.slice(0, 8)}-${Date.now().toString(36)}`
  const groupName = `MABRIG-${String(journey.segmentKey || 'growth').slice(0, 32)}-${suffix}`
  const templateName = `MABRIG-${String(journey.title || 'campaign').slice(0, 48)}-${suffix}`

  let groupId: number | null = null
  let templateId: number | null = null
  let taskAttempted = false

  try {
    const group = await createContactGroup({
      name: groupName,
      description:
        `MABRIG Growth Autopilot audience for journey ${action.details.journeyId}. Signed approval ${action.id}.`,
    })
    groupId = Number(group.group_id)
    if (!groupId) throw new Error('BillionMail created a group without returning group_id.')

    const imported = await importContactsToGroup(groupId, recipients)
    if (Number(imported.imported_count ?? 0) <= 0) {
      throw new Error('BillionMail did not import any approved recipients.')
    }

    const template = await createEmailTemplate({
      name: templateName,
      html: campaignDraft.html,
    })
    templateId = Number(template.id)
    if (!templateId) throw new Error('BillionMail created a template without returning template id.')

    const startTime = Math.floor(Date.now() / 1000) + settings.startDelay
    taskAttempted = true
    const task = await createMarketingTask({
      addresser: settings.sender,
      fullName: settings.senderName,
      subject: campaignDraft.subject,
      groupId,
      templateId,
      startTime,
      threads: settings.threads,
      warmup: settings.warmup,
      trackOpen: settings.trackOpen,
      trackClick: settings.trackClick,
      remark: `MABRIG Growth Autopilot journey ${action.details.journeyId}; approval ${action.id}`,
    })

    const taskId = Number(task.id)
    if (!taskId) throw new Error('BillionMail created a campaign task without returning task id.')

    await updateGrowthJourneyStatus(action.details.journeyId, 'scheduled', {
      executedAt: new Date(),
      approvalActionId: action.id,
      billionMail: {
        groupId,
        templateId,
        taskId,
        sender: settings.sender,
        scheduledStartTime: startTime,
        recipientCount: recipients.length,
      },
    })

    return {
      operation: 'scheduled',
      journeyId: action.details.journeyId,
      groupId,
      templateId,
      taskId,
      recipientCount: recipients.length,
      removedSinceApproval:
        Number(journey.approvedAudienceCount ?? recipients.length) - recipients.length,
      scheduledStartTime: startTime,
      sender: settings.sender,
      dnsWarnings: dns.warnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign execution failed.'

    await updateGrowthJourneyStatus(action.details.journeyId, 'execution-failed', {
      executionFailedAt: new Date(),
      executionError: message.slice(0, 500),
      approvalActionId: action.id,
      partialBillionMail: {
        groupId,
        templateId,
        taskAttempted,
      },
    })

    // Cleanup is safe only before task creation was attempted. Once a task request was sent,
    // network failure can make the upstream result ambiguous, so artifacts are preserved.
    if (!taskAttempted) {
      if (templateId) {
        try { await deleteEmailTemplate(templateId) } catch {}
      }
      if (groupId) {
        try { await deleteContactGroup(groupId) } catch {}
      }
    }

    throw error
  }
}
