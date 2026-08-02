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

function conditionLabel(condition: RuleCondition, dict: Dictionary): string {
  switch (condition.type) {
    case "from_list":
      return condition.list === "family"
        ? dict.rules.conditionFamily
        : dict.rules.conditionPartners
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
    case "keyword_any":
      return dict.rules.conditionKeywordsAny.replace(
        "{keywords}",
        condition.keywords.join(", ")
      )
    case "keyword_all":
      return dict.rules.conditionKeywordsAll.replace(
        "{keywords}",
        condition.keywords.join(", ")
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

export function mirrorSentence(
  rule: Pick<MessageRuleDraft, "conditions" | "actions" | "isCatchAll">,
  dict: Dictionary
): string {
  const when = rule.isCatchAll
    ? dict.rules.catchAll
    : rule.conditions.length > 0
      ? rule.conditions.map((c) => conditionLabel(c, dict)).join(" · ")
      : dict.rules.unknownWhen
  return dict.rules.mirror
    .replace("{when}", when)
    .replace("{then}", actionsSummary(rule.actions, dict))
}

export function listItemSummary(rule: MessageRule, dict: Dictionary): string {
  const when = rule.isCatchAll
    ? dict.rules.catchAll
    : rule.conditions.map((c) => conditionLabel(c, dict)).join(" · ")
  return `${dict.rules.when}: ${when} · ${dict.rules.then}: ${actionsSummary(rule.actions, dict)}`
}

export { conditionLabel, actionsSummary, priorityLabel }
