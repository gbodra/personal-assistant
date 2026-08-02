export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type GenericTable<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type SchemaSection<Tables extends Record<string, GenericTable<unknown>>> = {
  Tables: Tables
  Views: Record<string, never>
  Functions: Record<string, never>
  Enums: Record<string, never>
  CompositeTypes: Record<string, never>
}

export type Database = {
  next_auth: SchemaSection<{
    users: GenericTable<
      {
        id: string
        name: string | null
        email: string | null
        emailVerified: string | null
        image: string | null
        password_hash: string | null
      },
      {
        id?: string
        name?: string | null
        email?: string | null
        emailVerified?: string | null
        image?: string | null
        password_hash?: string | null
      }
    >
    accounts: GenericTable<
      {
        id: string
        type: string
        provider: string
        providerAccountId: string
        refresh_token: string | null
        access_token: string | null
        expires_at: number | null
        token_type: string | null
        scope: string | null
        id_token: string | null
        session_state: string | null
        oauth_token_secret: string | null
        oauth_token: string | null
        userId: string | null
      },
      {
        id?: string
        type: string
        provider: string
        providerAccountId: string
        refresh_token?: string | null
        access_token?: string | null
        expires_at?: number | null
        token_type?: string | null
        scope?: string | null
        id_token?: string | null
        session_state?: string | null
        oauth_token_secret?: string | null
        oauth_token?: string | null
        userId?: string | null
      }
    >
    sessions: GenericTable<
      {
        id: string
        expires: string
        sessionToken: string
        userId: string | null
      },
      {
        id?: string
        expires: string
        sessionToken: string
        userId?: string | null
      }
    >
    verification_tokens: GenericTable<
      {
        identifier: string | null
        token: string
        expires: string
      },
      {
        identifier?: string | null
        token: string
        expires: string
      }
    >
  }>
  app: SchemaSection<{
    boards: GenericTable<
      {
        id: string
        user_id: string
        name: string
        slug: string
        created_at: string
      },
      {
        id?: string
        user_id: string
        name: string
        slug: string
        created_at?: string
      }
    >
    lanes: GenericTable<
      {
        id: string
        board_id: string
        key: string
        name: string
        position: number
      },
      {
        id?: string
        board_id: string
        key: string
        name: string
        position: number
      }
    >
    cards: GenericTable<
      {
        id: string
        board_id: string
        lane_id: string
        user_id: string
        title: string
        description: string | null
        due_at: string | null
        position: number
        priority: string
        source_message_id: string | null
        archived_at: string | null
        created_at: string
        updated_at: string
      },
      {
        id?: string
        board_id: string
        lane_id: string
        user_id: string
        title: string
        description?: string | null
        due_at?: string | null
        position: number
        priority?: string
        source_message_id?: string | null
        archived_at?: string | null
        created_at?: string
        updated_at?: string
      }
    >
    tags: GenericTable<
      {
        id: string
        user_id: string
        name: string
        color: string | null
      },
      {
        id?: string
        user_id: string
        name: string
        color?: string | null
      }
    >
    card_tags: GenericTable<
      {
        card_id: string
        tag_id: string
      },
      {
        card_id: string
        tag_id: string
      }
    >
    activity_events: GenericTable<
      {
        id: string
        user_id: string
        board_id: string | null
        entity_type: string
        entity_id: string
        action: string
        payload: Json
        created_at: string
      },
      {
        id?: string
        user_id: string
        board_id?: string | null
        entity_type: string
        entity_id: string
        action: string
        payload?: Json
        created_at?: string
      }
    >
    important_contacts: GenericTable<
      {
        id: string
        user_id: string
        name: string
        phone: string
        contact_group: string
        created_at: string
        updated_at: string
      },
      {
        id?: string
        user_id: string
        name: string
        phone: string
        contact_group: string
        created_at?: string
        updated_at?: string
      }
    >
    whatsapp_groups: GenericTable<
      {
        id: string
        user_id: string
        external_group_id: string
        name: string
        created_at: string
        updated_at: string
      },
      {
        id?: string
        user_id: string
        external_group_id: string
        name: string
        created_at?: string
        updated_at?: string
      }
    >
    message_rules: GenericTable<
      {
        id: string
        user_id: string
        name: string
        enabled: boolean
        position: number
        schema_version: number
        conditions: Json
        actions: Json
        is_catch_all: boolean
        source_utterance: string | null
        created_at: string
        updated_at: string
      },
      {
        id?: string
        user_id: string
        name: string
        enabled?: boolean
        position: number
        schema_version?: number
        conditions?: Json
        actions: Json
        is_catch_all?: boolean
        source_utterance?: string | null
        created_at?: string
        updated_at?: string
      }
    >
    messages_received: GenericTable<
      {
        id: string
        created_at: string
        from: string | null
        message: string | null
        message_type: string | null
        image_base64: string | null
        video_bse64: string | null
        audio_base64: string | null
        processed: boolean | null
        is_group: boolean
        group_id: string | null
        participant: string | null
        was_mentioned: boolean
        user_id: string
        matched_rule_id: string | null
        card_id: string | null
        classification: Json
        processed_at: string | null
      },
      {
        id?: string
        created_at?: string
        from?: string | null
        message?: string | null
        message_type?: string | null
        image_base64?: string | null
        video_bse64?: string | null
        audio_base64?: string | null
        processed?: boolean | null
        is_group?: boolean
        group_id?: string | null
        participant?: string | null
        was_mentioned?: boolean
        user_id: string
        matched_rule_id?: string | null
        card_id?: string | null
        classification?: Json
        processed_at?: string | null
      }
    >
  }>
}
