import "./globals.css";
import PwaRegistration from "../components/PwaRegistration";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Deutsches Stellenregister | KhalfaJobs",
    template: "%s | KhalfaJobs",
  },
  description: "SaaS-Suche fuer Stellenangebote und E-Mail-Benachrichtigungen fuer Arbeitsvermittlungen.",
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
