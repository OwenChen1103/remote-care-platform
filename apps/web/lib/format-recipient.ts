export function formatRecipient(r: {
  id: string;
  caregiver_id: string;
  patient_user_id?: string | null;
  name: string;
  date_of_birth: Date | null;
  gender: string | null;
  medical_tags: unknown;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: r.id,
    caregiver_id: r.caregiver_id,
    patient_user_id: r.patient_user_id ?? null,
    name: r.name,
    date_of_birth: r.date_of_birth ? r.date_of_birth.toISOString().split('T')[0] : null,
    gender: r.gender,
    medical_tags: r.medical_tags as string[],
    emergency_contact_name: r.emergency_contact_name,
    emergency_contact_phone: r.emergency_contact_phone,
    notes: r.notes,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };
}
