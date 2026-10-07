/**
 * Shared helpers for CMS list search / filters.
 * All values come from URL searchParams (server components).
 */

export function sp(searchParams) {
  const g = (k, fallback = '') => {
    const v = searchParams?.[k];
    if (v == null || v === '') return fallback;
    return String(v);
  };
  return {
    q: g('q').trim(),
    status: g('status'),
    chain: g('chain'),
    type: g('type'),
    from: g('from'),
    to: g('to'),
    banned: g('banned'),
    sort: g('sort', 'newest'),
    page: Math.max(1, parseInt(g('page', '1'), 10) || 1),
    limit: Math.min(200, Math.max(10, parseInt(g('limit', '50'), 10) || 50)),
  };
}

export function offset(f) {
  return (f.page - 1) * f.limit;
}

/** Build href preserving current filters with overrides */
export function hrefWith(base, current, overrides = {}) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v == null || v === '' || k === 'page' && Number(v) === 1) continue;
    if (k === 'limit' && Number(v) === 50) continue;
    if (k === 'sort' && v === 'newest') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
