/**
 * Provider certifications encode TWO categories in a single string[] using ';'
 * as a sentinel separator (per PDF p7 「相關證照、其他證照」). The shape:
 *
 *   ['CPR', 'first-aid', ';', 'cooking-license']
 *                          ^ marker — everything after this is "other"
 *
 * If there are no "other" certifications, ';' is omitted entirely:
 *
 *   ['CPR', 'first-aid']
 *
 * Edit forms (mobile provider-edit, provider-profile onboarding) call
 * `splitCertifications` to re-populate two text inputs, then re-encode with
 * `encodeCertifications` on submit.
 *
 * Display surfaces (admin candidate cards, provider review page, [requestId]
 * provider card) call `flattenCertifications` to strip the sentinel and render
 * a single chip list — the related/other distinction is not meaningful when
 * just listing capabilities.
 */

const SEPARATOR = ';';

export interface SplitCertifications {
  related: string[];
  other: string[];
}

/**
 * Split a flat encoded certifications array into related + other parts.
 * - Before the first ';' → related
 * - After the first ';' → other
 * - No ';' at all → everything is related
 */
export function splitCertifications(certs: string[] | null | undefined): SplitCertifications {
  if (!Array.isArray(certs) || certs.length === 0) {
    return { related: [], other: [] };
  }
  const sepIdx = certs.indexOf(SEPARATOR);
  if (sepIdx === -1) {
    return { related: certs.slice(), other: [] };
  }
  return {
    related: certs.slice(0, sepIdx),
    other: certs.slice(sepIdx + 1),
  };
}

/**
 * Encode a related/other pair into the flat sentinel format the backend stores.
 * Drops the sentinel entirely when there are no "other" certifications, keeping
 * legacy storage shape for the common case.
 */
export function encodeCertifications(related: string[], other: string[]): string[] {
  if (other.length === 0) return related;
  return [...related, SEPARATOR, ...other];
}

/**
 * Strip the ';' sentinel so display surfaces show only real cert values.
 * Use this whenever you render certifications without preserving the category split.
 */
export function flattenCertifications(certs: string[] | null | undefined): string[] {
  if (!Array.isArray(certs)) return [];
  return certs.filter((c) => c !== SEPARATOR);
}
