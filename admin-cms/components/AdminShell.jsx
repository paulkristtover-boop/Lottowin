import Sidebar from './Sidebar';

export default function AdminShell({ children, title }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        {title && <h2 style={{ marginTop: 0 }}>{title}</h2>}
        {children}
      </main>
    </div>
  );
}
