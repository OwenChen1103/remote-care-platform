/**
 * Parse a list-endpoint `?sort=field:asc|desc` parameter against a whitelist.
 *
 * Each list endpoint must declare which fields are sortable — the whitelist
 * prevents callers from injecting arbitrary column names into a Prisma
 * `orderBy` (which would otherwise be a SQL surface). Invalid / missing /
 * non-whitelisted params silently fall back to the endpoint's default.
 *
 * Examples:
 *   parseSortParam('created_at:desc', ['name', 'created_at'], {})
 *     → { created_at: 'desc' }
 *   parseSortParam('email:asc', ['name', 'created_at'], { created_at: 'desc' })
 *     → { created_at: 'desc' }     // email not allowed, fall back
 *   parseSortParam(null, [...], { created_at: 'desc' })
 *     → { created_at: 'desc' }
 */
export function parseSortParam(
  sortParam: string | null | undefined,
  allowedFields: readonly string[],
  defaultOrderBy: Record<string, 'asc' | 'desc'>,
): Record<string, 'asc' | 'desc'> {
  if (!sortParam) return defaultOrderBy;
  const [field, direction] = sortParam.split(':');
  if (!field) return defaultOrderBy;
  if (direction !== 'asc' && direction !== 'desc') return defaultOrderBy;
  if (!allowedFields.includes(field)) return defaultOrderBy;
  return { [field]: direction };
}
