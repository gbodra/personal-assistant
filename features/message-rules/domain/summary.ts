import type { Dictionary } from "@/lib/i18n"
import type {
  MessageRule,
  MessageRuleDraft,
  Priority,
  RuleActions,
  RuleCondition,
} from "./types"

function priorityLabel(priority: Priority, dict: Dictionary): string {
  return dict.rules.priority[priority]
}

function truncateList(items: string[], max = 3): string {
  if (items.length <= max) return items.join(", ")
  return `${items.slice(0, max).join(", ")} +${items.length - max}`
}

function conditionLabel(condition: RuleCondition, dict: Dictionary): string {
  switch (condition.type) {
    case "from_list": {
      switch (condition.list) {
        case "family":
          return dict.rules.conditionFamily
        case "partners":
          return dict.rules.conditionPartners
        case "clients":
          return dict.rules.conditionClients
        default: {
          const _exhaustive: never = condition.list
          return _exhaustive
        }
      }
    }
    case "from_phones":
      return dict.rules.conditionPhones.replace(
        "{count}",
        String(condition.phones.length)
      )
    case "in_groups":
      return dict.rules.conditionGroups.replace(
        "{count}",
        String(condition.group_ids.length)
      )
    case "was_mentioned":
      return dict.rules.conditionMentioned
    case "message_type":
      return dict.rules.conditionMessageType.replace(
        "{types}",
        condition.types.join(", ")
      )
    case "theme_any":
      return dict.rules.conditionThemes.replace(
        "{themes}",
        truncateList(condition.themes)
      )
    default: {
      const _exhaustive: never = condition
      return _exhaustive
    }
  }
}

function actionsSummary(actions: RuleActions, dict: Dictionary): string {
  if (actions.disposition === "ignore") {
    return dict.rules.actionIgnore
  }
  const tags =
    actions.tag_names && actions.tag_names.length > 0
      ? actions.tag_names.join(", ")
      : actions.tag_ids.length > 0
        ? `${actions.tag_ids.length} tags`
        : dict.rules.noTags
  return dict.rules.actionCreate
    .replace("{priority}", priorityLabel(actions.priority, dict))
    .replace("{tags}", tags)
}

function joinWhen(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0] ?? ""
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`
}

export function mirrorSentence(
  rule: Pick<MessageRuleDraft, "conditions" | "actions" | "isCatchAll">,
  dict: Dictionary
): string {
  const when = rule.isCatchAll
    ? dict.rules.catchAll
    : rule.conditions.length > 0
      ? joinWhen(rule.conditions.map((c) => conditionLabel(c, dict)))
      : dict.rules.unknownWhen
  return dict.rules.mirror
    .replace("{when}", when)
    .replace("{then}", actionsSummary(rule.actions, dict))
}

export function listItemSummary(rule: MessageRule, dict: Dictionary): string {
  const when = rule.isCatchAll
    ? dict.rules.catchAll
    : joinWhen(rule.conditions.map((c) => conditionLabel(c, dict)))
  return `${dict.rules.when}: ${when} · ${dict.rules.then}: ${actionsSummary(rule.actions, dict)}`
}

export { conditionLabel, actionsSummary, priorityLabel }
