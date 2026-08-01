import type { FamilyMember } from "@/features/family/domain/types"
import { getAppAdmin } from "@/lib/supabase/admin"

function mapMember(row: {
  id: string
  user_id: string
  name: string
  phone: string
  created_at: string
  updated_at: string
}): FamilyMember {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listFamilyMembers(userId: string): Promise<FamilyMember[]> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("family_members")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(`Failed to list family members: ${error.message}`)
  }

  return (data ?? []).map(mapMember)
}

export async function createFamilyMember(input: {
  userId: string
  name: string
  phone: string
}): Promise<FamilyMember> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("family_members")
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      phone: input.phone.trim(),
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create family member: ${error?.message}`)
  }

  return mapMember(data)
}

export async function updateFamilyMember(input: {
  userId: string
  id: string
  name: string
  phone: string
}): Promise<FamilyMember> {
  const db = getAppAdmin()
  const { data, error } = await db
    .from("family_members")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error ? `Failed to update: ${error.message}` : "NOT_FOUND")
  }

  return mapMember(data)
}

export async function deleteFamilyMember(input: {
  userId: string
  id: string
}): Promise<void> {
  const db = getAppAdmin()
  const { error, count } = await db
    .from("family_members")
    .delete({ count: "exact" })
    .eq("id", input.id)
    .eq("user_id", input.userId)

  if (error) {
    throw new Error(`Failed to delete family member: ${error.message}`)
  }

  if (count === 0) {
    throw new Error("NOT_FOUND")
  }
}
