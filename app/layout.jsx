import "./globals.css";

export const metadata = {
  title: "Deutsches Stellenregister",
  description: "SaaS-Suche fuer Stellenangebote und E-Mail-Benachrichtigungen fuer Arbeitsvermittlungen.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
