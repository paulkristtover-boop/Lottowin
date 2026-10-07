import AdminShell from '@/components/AdminShell';
import MessageForm from './MessageForm';

export default function MessagePage() {
  return (
    <AdminShell title="Message User">
      <div className="card">
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Messages are wrapped in an <strong>official Support envelope</strong> so users can
          distinguish real staff from fake admins. Never ask for seeds, keys, or passwords.
        </p>
      </div>
      <MessageForm />
    </AdminShell>
  );
}
