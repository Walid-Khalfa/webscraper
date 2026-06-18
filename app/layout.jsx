import "./globals.css";
import PwaRegistration from "../components/PwaRegistration";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://emploi-agences-next.vercel.app";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Deutsches Stellenregister | KhalfaJobs",
    template: "%s | KhalfaJobs",
  },
  description: "Professionelle Live-Suche fuer Stellenangebote mit CSV-Export und Job-Alarmen fuer Arbeitsvermittlungen und Recruiting-Teams.",
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
