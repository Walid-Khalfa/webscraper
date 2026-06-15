import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

const icons = {
  error: AlertTriangle,
  loading: LoaderCircle,
  success: CheckCircle2,
};

export default function ToastStack({ toasts }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || CheckCircle2;
        return (
          <div className={`toast toast-${toast.type}`} key={toast.id}>
            <Icon className={toast.type === "loading" ? "spin" : ""} size={18} aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

