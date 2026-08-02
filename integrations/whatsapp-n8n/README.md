# WhatsApp → n8n → PersonalOS (message rules contract)

V1: the Next.js app **only CRUD-configures** rules in Supabase. **n8n evaluates** rules and creates/ignores Focus cards.

## Tables

| Table | Role |
|-------|------|
| `app.messages_received` | Ingest from Evolution API |
| `app.message_rules` | Structured rules (`schema_version = 1`) |
| `app.family_members` / `app.business_partners` | Phone lists for `from_list` |
| `app.whatsapp_groups` | Labels ↔ Evolution `external_group_id` |
| `app.cards` / `app.card_tags` / `app.tags` | Card write path |
| `app.normalize_phone(text)` | Digits-only phone normalize |

## Ingest requirements

When inserting into `messages_received`, set:

- `user_id` (required for multi-user / RLS)
- `from`, `message`, `message_type`
- `is_group`, `group_id`, `participant`, `was_mentioned`
- `processed = false`

## Load (per batch)

```sql
SELECT * FROM app.messages_received
WHERE processed = false AND user_id = $user_id
ORDER BY created_at ASC
LIMIT 50;

SELECT * FROM app.message_rules
WHERE user_id = $user_id AND enabled = true
ORDER BY position ASC;

SELECT phone FROM app.family_members WHERE user_id = $user_id;
SELECT phone FROM app.business_partners WHERE user_id = $user_id;
```

Normalize phones with `app.normalize_phone` (or equivalent digits-only) before matching `from` / `participant`.

## Evaluate (first-match)

```
for rule in rules ordered by position ASC:
  if rule.is_catch_all OR all conditions match (AND):
    apply rule.actions
    break
else:
  disposition = none  # do not create a card
```

### Condition types (`schema_version` 1)

| type | Match |
|------|--------|
| `from_list` | `list`: `family` \| `partners` — sender phone ∈ list (DM uses `from`, group uses `participant`) |
| `from_phones` | exact normalized phones |
| `in_groups` | `is_group` and `group_id` ∈ `group_ids` |
| `was_mentioned` | `was_mentioned = true` |
| `message_type` | `message_type` ∈ `types` |
| `keyword_any` / `keyword_all` | substring match on `message` |

Unknown `type` → condition is **false** (fail-closed).

### Actions

```json
{ "disposition": "create", "priority": "critical|high|normal|low", "tag_ids": ["uuid"], "lane_key": "todo" }
{ "disposition": "ignore" }
```

## Write

**Ignore or no-match**

```sql
UPDATE app.messages_received SET
  processed = true,
  processed_at = now(),
  matched_rule_id = $rule_id_or_null,
  classification = $classification
WHERE id = $id AND processed = false;
```

**Create**

1. Resolve Daily Focus board (`slug = 'daily-focus'`) and lane `todo` for `user_id`.
2. Insert `app.cards` with `priority`, `title` (from message or `[media] from …`), optional `source_message_id`.
3. Insert `app.card_tags` for each `tag_ids` entry.
4. Update message with `card_id`, `matched_rule_id`, `classification`, `processed = true`.

### `classification` payload

```json
{
  "disposition": "create|ignore|none",
  "priority": "high",
  "tag_ids": [],
  "schema_version": 1,
  "evaluator": "n8n@1",
  "evaluated_at": "ISO-8601",
  "match_mode": "first_match"
}
```

## Idempotency

Only process rows with `processed = false`. If `card_id` is already set, skip.

## Auth

n8n uses Supabase **service_role**. Never expose that key in the browser.

## App UI

Rules module: `/rules` — natural language compile → confirm → save into `app.message_rules`.
