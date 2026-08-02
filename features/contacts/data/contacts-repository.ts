import {
  CONTACT_GROUPS,
  type ContactGroup,
  type ImportantContact,
} from "@/features/contacts/domain/types"
import { getAppAdmin } from "@/lib/supabase/admin"

function isContactGroup(value: string): value is ContactGroup {
  return (CONTACT_GROUPS as readonly string[]).includes(value)
}

function mapContact(row: {
  id: string
  user_id: string
  name: string
  phone: string
  contact_group: string
  created_at: string
  updated_at: string
}): ImportantContact {
  if (!isContactGroup(row.contact_group)) {
    throw new Error(`Invalid contact_group: ${row.contact_group}`)
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    contactGroup: row.contact_group,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listImportantContacts(
  userId: string
): Promise<ImportantContact[]> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("important_contacts")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Failed to list contacts: ${error.message}`)
  }

  const contacts = (data ?? []).map(mapContact)
  const groupOrder = new Map(
    CONTACT_GROUPS.map((group, index) => [group, index])
  )

  return contacts.sort((a, b) => {
    const groupDiff =
      (groupOrder.get(a.contactGroup) ?? 0) -
      (groupOrder.get(b.contactGroup) ?? 0)
    if (groupDiff !== 0) return groupDiff
    return a.name.localeCompare(b.name)
  })
}

export async function createImportantContact(input: {
  userId: string
  name: string
  phone: string
  contactGroup: ContactGroup
}): Promise<ImportantContact> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("important_contacts")
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      contact_group: input.contactGroup,
    })
    .select("*")
    .single()

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("DUPLICATE_PHONE")
    }
    throw new Error(`Failed to create contact: ${error?.message}`)
  }

  return mapContact(data)
}

export async function updateImportantContact(input: {
  userId: string
  id: string
  name: string
  phone: string
  contactGroup: ContactGroup
}): Promise<ImportantContact> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("important_contacts")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
      contact_group: input.contactGroup,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .select("*")
    .single()

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("DUPLICATE_PHONE")
    }
    throw new Error(error ? `Failed to update: ${error.message}` : "NOT_FOUND")
  }

  return mapContact(data)
}

export async function deleteImportantContact(input: {
  userId: string
  id: string
}): Promise<void> {
  const db = getAppAdmin()
  const { error, count } = await db
    .from("important_contacts")
    .delete({ count: "exact" })
    .eq("id", input.id)
    .eq("user_id", input.userId)

  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`)
  }

  if (count === 0) {
    throw new Error("NOT_FOUND")
  }
}
