import Link from 'next/link';
import { hrefWith } from '@/lib/filters';

export default function Pagination({ base, filters, total }) {
  const pages = Math.max(1, Math.ceil(total / filters.limit));
  if (pages <= 1) return null;

  const page = filters.page;
  const prev = page > 1 ? page - 1 : null;
  const next = page < pages ? page + 1 : null;

  return (
    <div className="pagination">
      {prev ? (
        <Link className="btn ghost sm" href={hrefWith(base, filters, { page: prev })}>
          ← Prev
        </Link>
      ) : (
        <span className="btn ghost sm" style={{ opacity: 0.4 }}>
          ← Prev
        </span>
      )}
      <span className="page-info">
        Page {page} / {pages}
      </span>
      {next ? (
        <Link className="btn ghost sm" href={hrefWith(base, filters, { page: next })}>
          Next →
        </Link>
      ) : (
        <span className="btn ghost sm" style={{ opacity: 0.4 }}>
          Next →
        </span>
      )}
    </div>
  );
}
