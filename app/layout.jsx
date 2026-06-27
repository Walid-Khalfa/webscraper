import "./globals.css";
import PwaRegistration from "../components/PwaRegistration";
import { appUrl, defaultDescription, defaultTitle, siteName } from "../lib/site-config";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    siteName,
    locale: "de_DE",
    type: "website",
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
