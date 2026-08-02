# WhatsApp → n8n → PersonalOS (message rules contract)

The Next.js app **only CRUD-configures** rules in Supabase. **n8n evaluates** rules and creates/ignores Focus cards.

## Tables

| Table | Role |
|-------|------|
| `app.messages_received` | Ingest from Evolution API |
| `app.message_rules` | Structured rules (`schema_version = 3`) |
| `app.important_contacts` | Phone lists for `from_list` (`contact_group`: `partners` \| `family` \| `clients`) |
| `app.whatsapp_groups` | Labels ↔ Evolution `external_group_id` |
| `app.cards` / `app.card_tags` / `app.tags` | Card write path |
| `app.normalize_phone(text)` | Digits-only phone normalize |

## Ingest requirements

When inserting into `messages_received`, set:

- `user_id` (**NOT NULL** — required; rows without an owner are rejected by the database)
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

SELECT phone, contact_group FROM app.important_contacts WHERE user_id = $user_id;
```

Normalize phones with `app.normalize_phone` (or equivalent digits-only) before matching `from` / `participant`. Partition contacts in memory by `contact_group`.

## Evaluate (first-match)

```
for rule in rules ordered by position ASC:
  if rule.is_catch_all OR all conditions match (AND):
    apply rule.actions
    break
else:
  disposition = none  # do not create a card
```

### Condition types (`schema_version` 3)

| type | Match |
|------|--------|
| `from_list` | `list`: `partners` \| `family` \| `clients` — sender phone ∈ contacts with that `contact_group` (DM uses `from`, group uses `participant`) |
| `from_phones` | exact normalized phones |
| `in_groups` | `is_group` and `group_id` ∈ `group_ids` |
| `was_mentioned` | `was_mentioned = true` |
| `message_type` | `message_type` ∈ `types` |
| `theme_any` | LLM: message is about **any** of the listed themes (see below) |

Unknown `type` → condition is **false** (fail-closed).

### Per-rule evaluation order

1. Evaluate all **deterministic** conditions (`from_list`, `from_phones`, `in_groups`, `was_mentioned`, `message_type`) without an LLM.
2. If any deterministic condition fails → rule does not match (do **not** call the LLM).
3. If the rule has `theme_any` → call the LLM once with the message text and `themes[]`. Match if **any** theme is present. On LLM/API/parse failure → condition is **false** (fail-closed).
4. If all conditions pass → apply `actions`.

### `theme_any` LLM contract

Input (conceptual):

- `message`: string (message body; for media without text, use a short placeholder such as `[image]` / `[audio]`)
- `themes`: string[] (1–10 natural-language criteria)

Expected JSON output:

```json
{
  "matches": true,
  "matched_themes": ["urgência familiar por doença ou problema de saúde"]
}
```

- `matches` is `true` if **any** theme is semantically present (synonyms / paraphrase count; exact wording not required).
- Prefer a cheap structured model; temperature `0`.

Example rule:

```json
{
  "conditions": [
    { "type": "from_list", "list": "family" },
    {
      "type": "theme_any",
      "themes": [
        "urgência familiar por doença ou problema de saúde",
        "alguém machucado, ferido ou acidentado"
      ]
    }
  ],
  "actions": {
    "disposition": "create",
    "priority": "high",
    "tag_ids": [],
    "lane_key": "todo"
  }
}
```

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
  "schema_version": 3,
  "evaluator": "n8n@3",
  "evaluated_at": "ISO-8601",
  "match_mode": "first_match",
  "theme_match": {
    "matched_themes": ["urgência familiar por doença ou problema de saúde"]
  }
}
```

`theme_match` is optional; include when a `theme_any` condition was evaluated.

## Idempotency

Only process rows with `processed = false`. If `card_id` is already set, skip.

## Auth

n8n uses Supabase **service_role**. Never expose that key in the browser.

## App UI

Rules module: `/rules` — natural language compile → confirm (editable who + themes) → save into `app.message_rules`.
