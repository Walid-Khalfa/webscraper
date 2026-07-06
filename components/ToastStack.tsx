import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

const icons: Record<string, React.ComponentType<any>> = {
  error: AlertTriangle,
  loading: LoaderCircle,
  success: CheckCircle2,
};

interface Toast {
  id: string;
  type: string;
  message: string;
}

interface ToastStackProps {
  toasts: Toast[];
}

export default function ToastStack({ toasts }: ToastStackProps) {
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
