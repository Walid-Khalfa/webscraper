import { Mail } from "lucide-react";
import type { ReactNode } from "react";

type AlertManagerProps = {
  agentOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  statusBanner?: ReactNode;
  subscriptions?: ReactNode;
};

export default function AlertManager({ agentOpen, onToggle, children, statusBanner, subscriptions }: AlertManagerProps) {
  return (
    <section className="saas-section secondary-zone" id="job-alarm">
      <div className="saas-header">
        <div>
          <p className="eyebrow">Job-Alarm fuer Recruiting-Teams</p>
          <h2>Neue passende Stellenangebote automatisch per E-Mail erhalten.</h2>
        </div>
        <button className="secondary-action" type="button" onClick={onToggle} aria-expanded={agentOpen}>
          <Mail size={18} aria-hidden="true" />
          {agentOpen ? "Job-Alarm ausblenden" : "Job-Alarm einrichten"}
        </button>
      </div>

      {agentOpen ? children : null}
      {statusBanner}
      {subscriptions}
    </section>
  );
}

