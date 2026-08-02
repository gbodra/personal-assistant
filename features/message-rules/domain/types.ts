import {
  CONTACT_GROUPS,
  type ContactGroup,
} from "@/features/contacts/domain/types"

export const PRIORITIES = ["critical", "high", "normal", "low"] as const
export type Priority = (typeof PRIORITIES)[number]

export const CONTACT_LISTS = CONTACT_GROUPS
export type ContactList = ContactGroup

export const MESSAGE_TYPES = [
  "text",
  "image",
  "audio",
  "video",
  "other",
] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

export type FromListCondition = {
  type: "from_list"
  list: ContactList
}

export type FromPhonesCondition = {
  type: "from_phones"
  phones: string[]
}

export type InGroupsCondition = {
  type: "in_groups"
  group_ids: string[]
}

export type WasMentionedCondition = {
  type: "was_mentioned"
}

export type MessageTypeCondition = {
  type: "message_type"
  types: MessageType[]
}

export type ThemeAnyCondition = {
  type: "theme_any"
  themes: string[]
}

export type RuleCondition =
  | FromListCondition
  | FromPhonesCondition
  | InGroupsCondition
  | WasMentionedCondition
  | MessageTypeCondition
  | ThemeAnyCondition

export type CreateActions = {
  disposition: "create"
  priority: Priority
  tag_ids: string[]
  tag_names?: string[]
  lane_key?: "todo"
}

export type IgnoreActions = {
  disposition: "ignore"
}

export type RuleActions = CreateActions | IgnoreActions

export type MessageRule = {
  id: string
  userId: string
  name: string
  enabled: boolean
  position: number
  schemaVersion: number
  conditions: RuleCondition[]
  actions: RuleActions
  isCatchAll: boolean
  sourceUtterance: string | null
  createdAt: string
  updatedAt: string
}

export type MessageRuleDraft = {
  name: string
  conditions: RuleCondition[]
  actions: RuleActions
  isCatchAll: boolean
  sourceUtterance: string
  tagNames: string[]
  warnings: string[]
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}
