"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logError, clientPrefix } from "./logger";

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
      errorMessage: error?.message || "Unbekannter Darstellungsfehler",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // We pre-extract Error properties because JSON.stringify(error) returns
    // `"{}"` (Error's own fields aren't enumerable). Stack is truncated to
    // 1000 chars so a deeply crash-nested stack doesn't blow up the
    // logfmt-keyed line that the unified Vercel drain parses.
    const errorStack =
      typeof error?.stack === "string" ? error.stack.slice(0, 1000) : undefined;
    logError(clientPrefix("ui-boundary"), "React error boundary caught", {
      error_message: error?.message,
      error_name: error?.name,
      error_stack: errorStack,
      component_stack: errorInfo?.componentStack,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
    });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title || "Dieser Bereich ist momentan nicht verfügbar.";
    const description =
      this.props.description ||
      "Bitte laden Sie diesen Abschnitt erneut. Falls das Problem bestehen bleibt, prüfen Sie die Browser-Konsole oder das Deployment-Log.";

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
            Abschnitt neu laden
          </button>
        </section>
      );
    }

    return (
      <div className="error-surface" role="alert">
        <p className="eyebrow">Fehlerbehandlung aktiv</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <p style={{ fontSize: "0.92rem", color: "#6b665c", marginTop: "0.25rem" }}>
          {this.state.errorMessage}
        </p>
        <div className="error-surface-actions">
          <button className="primary-action" type="button" onClick={this.handleReset}>
            <RefreshCw size={18} />
            Abschnitt neu laden
          </button>
        </div>
      </div>
    );
  }
}
