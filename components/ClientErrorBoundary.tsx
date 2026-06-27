"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  compact?: boolean;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export default class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Unbekannter Client-Fehler",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ui-boundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title || "Dieser Bereich konnte nicht geladen werden.";
    const description =
      this.props.description ||
      "Bitte laden Sie diesen Bereich erneut. Falls der Fehler wieder auftritt, pruefen Sie die Browser-Konsole oder das Deployment-Log.";

    if (this.props.compact) {
      return (
        <section className="zero-state" aria-live="polite" role="alert">
          <div className="zero-icon" aria-hidden="true">
            <AlertTriangle size={30} />
          </div>
          <h2>{title}</h2>
          <p>{description}</p>
          <p style={{ fontSize: "0.92rem", color: "#6b665c", marginTop: "0.25rem" }}>
            {this.state.errorMessage}
          </p>
          <button className="primary-action" type="button" onClick={this.handleReset}>
            <RefreshCw size={18} />
            Bereich neu laden
          </button>
        </section>
      );
    }

    return (
      <div className="error-surface" role="alert">
        <p className="eyebrow">Client-Fehler isoliert</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <p style={{ fontSize: "0.92rem", color: "#6b665c", marginTop: "0.25rem" }}>
          {this.state.errorMessage}
        </p>
        <div className="error-surface-actions">
          <button className="primary-action" type="button" onClick={this.handleReset}>
            <RefreshCw size={18} />
            Bereich neu laden
          </button>
        </div>
      </div>
    );
  }
}
