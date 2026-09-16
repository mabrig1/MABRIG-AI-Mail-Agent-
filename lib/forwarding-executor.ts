import type { ProposedAction } from '@/lib/approval'
import {
  addMailForward,
  deleteMailForward,
  editMailForward,
  listAllMailForwards,
} from '@/lib/billionmail'
import {
  assertNoForwardingLoop,
  validateForwardingRule,
  validateForwardingSource,
} from '@/lib/forwarding-policy'

export const FORWARDING_RULE_ACTIONS = new Set([
  'create_forward_rule',
  'edit_forward_rule',
  'delete_forward_rule',
])

function activeValue(value: string | undefined, fallback = 1) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (parsed !== 0 && parsed !== 1) throw new Error('Forwarding active state must be 0 or 1.')
  return parsed
}

export async function executeForwardingAction(action: ProposedAction) {
  const details = action.details ?? {}
  const address = details.address ?? ''

  if (action.type === 'create_forward_rule') {
    const normalized = validateForwardingRule(address, details.goto ?? '')
    const existing = await listAllMailForwards(normalized.sourceDomain)
    assertNoForwardingLoop(normalized.address, normalized.targets, existing)

    await addMailForward({
      address: normalized.address,
      goto: normalized.goto,
      active: activeValue(details.active, 1),
    })

    return {
      operation: 'created',
      resource: normalized.address,
      destinations: normalized.targets,
    }
  }

  if (action.type === 'edit_forward_rule') {
    const source = validateForwardingSource(address)
    const active = activeValue(details.active, 1)
    const goto = details.goto?.trim() ?? ''

    if (goto) {
      const normalized = validateForwardingRule(source.address, goto)
      const existing = await listAllMailForwards(normalized.sourceDomain)
      assertNoForwardingLoop(normalized.address, normalized.targets, existing)

      await editMailForward({
        address: normalized.address,
        goto: normalized.goto,
        active,
      })

      return {
        operation: 'edited',
        resource: normalized.address,
        destinations: normalized.targets,
        active,
      }
    }

    await editMailForward({
      address: source.address,
      active,
    })

    return {
      operation: 'status-updated',
      resource: source.address,
      active,
    }
  }

  if (action.type === 'delete_forward_rule') {
    const source = validateForwardingSource(address)
    await deleteMailForward(source.address)

    return {
      operation: 'deleted',
      resource: source.address,
    }
  }

  throw new Error('This approval is not a forwarding-rule action.')
}
