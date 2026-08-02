export const CONTACT_GROUPS = ["partners", "family", "clients"] as const
export type ContactGroup = (typeof CONTACT_GROUPS)[number]

export type ImportantContact = {
  id: string
  userId: string
  name: string
  phone: string
  contactGroup: ContactGroup
  createdAt: string
  updatedAt: string
}
