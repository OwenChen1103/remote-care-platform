/**
 * Recipient response formatter (shared by caregiver routes + admin routes).
 *
 * Surfaces `patient_user_email` and `patient_user_name` when the caller `include`s
 * `patient_user: { select: { email, name } }` in their Prisma query. When include is
 * absent, both surface as null — caller still gets a structurally valid response
 * (matches RecipientResponseSchema in shared package).
 */
export function formatRecipient(r: {
  id: string;
  caregiver_id: string;
  patient_user_id?: string | null;
  patient_user?: { email: string; name: string } | null;
  name: string;
  date_of_birth: Date | null;
  gender: string | null;
  relationship?: string | null;
  medical_tags: unknown;
  // Json column on Recipient (added by 20260329000000_add_lifestyle_habits migration).
  // Shape matches RecipientCreateSchema.lifestyle_habits — see packages/shared/src/schemas/recipient.ts.
  lifestyle_habits?: unknown;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  address?: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: r.id,
    caregiver_id: r.caregiver_id,
    patient_user_id: r.patient_user_id ?? null,
    patient_user_email: r.patient_user?.email ?? null,
    patient_user_name: r.patient_user?.name ?? null,
    name: r.name,
    date_of_birth: r.date_of_birth ? r.date_of_birth.toISOString().split('T')[0] : null,
    gender: r.gender,
    relationship: r.relationship ?? null,
    medical_tags: r.medical_tags as string[],
    // Default to {} so callers never see undefined; keys inside may all be optional.
    lifestyle_habits: (r.lifestyle_habits as Record<string, unknown>) ?? {},
    emergency_contact_name: r.emergency_contact_name,
    emergency_contact_phone: r.emergency_contact_phone,
    address: r.address ?? null,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}
