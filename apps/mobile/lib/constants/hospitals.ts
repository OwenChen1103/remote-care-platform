/**
 * Common hospitals (PDF p3 — escort visit destination dropdown).
 *
 * Lightweight curated list for MVP. Not authoritative. Caregiver can also type a
 * free-form hospital name / address (chip select OR free input — not exclusive).
 *
 * Future: replace with API-backed Hospital table if we need authoritative names,
 * branch addresses, or department metadata.
 */
export const COMMON_HOSPITALS: readonly string[] = [
  '台大醫院',
  '台北榮民總醫院',
  '三軍總醫院',
  '馬偕紀念醫院',
  '林口長庚醫院',
  '台中榮民總醫院',
  '中國醫藥大學附設醫院',
  '高雄醫學大學附設醫院',
  '高雄長庚醫院',
  '成大醫院',
] as const;
