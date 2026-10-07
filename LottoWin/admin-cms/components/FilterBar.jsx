'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

/**
 * Server-driven filter bar. Submits via URL search params (GET).
 *
 * props.fields = array of:
 *   { name, label, type: 'text'|'select'|'date', placeholder?, options?: [{value,label}] }
 */
export default function FilterBar({ fields = [], resultCount }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const initial = {};
  for (const f of fields) {
    initial[f.name] = searchParams.get(f.name) || '';
  }
  const [values, setValues] = useState(initial);

  const apply = useCallback(
    (e) => {
      e?.preventDefault?.();
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(values)) {
        if (v != null && String(v).trim() !== '') params.set(k, String(v).trim());
      }
      // reset page on new filter
      params.delete('page');
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [values, pathname, router]
  );

  const clear = useCallback(() => {
    const empty = {};
    for (const f of fields) empty[f.name] = '';
    setValues(empty);
    startTransition(() => router.push(pathname));
  }, [fields, pathname, router]);

  return (
    <form className="filter-bar card" onSubmit={apply}>
      <div className="filter-grid">
        {fields.map((f) => (
          <div key={f.name} className="filter-field">
            <label htmlFor={`f-${f.name}`}>{f.label}</label>
            {f.type === 'select' ? (
              <select
                id={`f-${f.name}`}
                value={values[f.name] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              >
                {(f.options || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`f-${f.name}`}
                type={f.type === 'date' ? 'date' : 'search'}
                placeholder={f.placeholder || ''}
                value={values[f.name] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      <div className="filter-actions">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? 'Searching…' : 'Search'}
        </button>
        <button type="button" className="btn ghost" onClick={clear} disabled={pending}>
          Clear
        </button>
        {resultCount != null && (
          <span className="filter-count">{resultCount} result{resultCount === 1 ? '' : 's'}</span>
        )}
      </div>
    </form>
  );
}
