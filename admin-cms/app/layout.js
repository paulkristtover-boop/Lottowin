import './globals.css';

export const metadata = {
  title: 'LottoWin Admin',
  description: 'Instant 4/40 Lottery CMS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
