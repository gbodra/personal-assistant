import { z } from "zod"

import {
  CONTACT_LISTS,
  MESSAGE_TYPES,
  PRIORITIES,
  type RuleActions,
  type RuleCondition,
} from "./types"

const fromListCondition = z.object({
  type: z.literal("from_list"),
  list: z.enum(CONTACT_LISTS),
})

const fromPhonesCondition = z.object({
  type: z.literal("from_phones"),
  phones: z.array(z.string().min(3).max(40)).min(1).max(50),
})

const inGroupsCondition = z.object({
  type: z.literal("in_groups"),
  group_ids: z.array(z.string().min(1).max(120)).min(1).max(50),
})

const wasMentionedCondition = z.object({
  type: z.literal("was_mentioned"),
})

const messageTypeCondition = z.object({
  type: z.literal("message_type"),
  types: z.array(z.enum(MESSAGE_TYPES)).min(1),
})

const themeAnyCondition = z.object({
  type: z.literal("theme_any"),
  themes: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
})

export const ruleConditionSchema: z.ZodType<RuleCondition> = z.discriminatedUnion(
  "type",
  [
    fromListCondition,
    fromPhonesCondition,
    inGroupsCondition,
    wasMentionedCondition,
    messageTypeCondition,
    themeAnyCondition,
  ]
)

const createActionsSchema = z.object({
  disposition: z.literal("create"),
  priority: z.enum(PRIORITIES),
  tag_ids: z.array(z.string().uuid()).max(20),
  tag_names: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  lane_key: z.literal("todo").optional(),
})

const ignoreActionsSchema = z.object({
  disposition: z.literal("ignore"),
})

export const ruleActionsSchema: z.ZodType<RuleActions> = z.discriminatedUnion(
  "disposition",
  [createActionsSchema, ignoreActionsSchema]
)

/** Draft after NL compile — may be incomplete until the user confirms. */
export const messageRuleDraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  conditions: z.array(ruleConditionSchema).max(20),
  actions: ruleActionsSchema,
  isCatchAll: z.boolean(),
  sourceUtterance: z.string().trim().min(1).max(4000),
  tagNames: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  warnings: z.array(z.string()).default([]),
})

export const saveRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    enabled: z.boolean().default(true),
    conditions: z.array(ruleConditionSchema).max(20),
    actions: ruleActionsSchema,
    isCatchAll: z.boolean().default(false),
    sourceUtterance: z.string().trim().max(4000).nullable().optional(),
    tagNames: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .superRefine((rule, ctx) => {
    if (!rule.isCatchAll && rule.conditions.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Rule needs conditions or must be catch-all",
        path: ["conditions"],
      })
    }
    if (rule.isCatchAll && rule.conditions.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Catch-all rules cannot have conditions",
        path: ["conditions"],
      })
    }
    if (rule.actions.disposition === "create") {
      const tagNames = rule.tagNames ?? []
      if (rule.actions.tag_ids.length === 0 && tagNames.length === 0) {
        // tags optional on create
      }
    }
  })

export const SCHEMA_VERSION = 3
