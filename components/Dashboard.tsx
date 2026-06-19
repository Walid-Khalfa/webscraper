import type { ReactNode } from "react";

type DashboardProps = {
  children: ReactNode;
};

export default function Dashboard({ children }: DashboardProps) {
  return (
    <section className="interactive-dashboard" aria-label="Interaktiver Recruiting-Dashboard">
      {children}
    </section>
  );
}

