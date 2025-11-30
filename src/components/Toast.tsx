import { useCallback, useEffect, useState } from 'react';

const SUCCESS_TOAST_DURATION_SECONDS = 2;

const normalizeDuration = (value?: number | null) => {
  if (value === null || value === undefined) {
    return null;
  }
  return value <= 10 ? value * 1000 : value;
};

type ToastType = 'success' | 'error';

interface ToastProps {
  message: string | null;
  type: ToastType;
  onClose: () => void;
  duration?: number | null;
}

export function Toast({ message, type, onClose, duration }: ToastProps) {
  const targetDuration = duration ?? (type === 'success' ? SUCCESS_TOAST_DURATION_SECONDS : null);
  const effectiveDuration = normalizeDuration(targetDuration);

  useEffect(() => {
    if (!message) {
      return;
    }
    if (effectiveDuration === null) {
      return;
    }
    const timer = setTimeout(onClose, effectiveDuration);
    return () => clearTimeout(timer);
  }, [message, effectiveDuration, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
      <button onClick={onClose} aria-label="Cerrar notificación">
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastDuration, setToastDuration] = useState<number | null>(null);

  const showToast = (message: string, type: ToastType = 'success', duration?: number | null) => {
    setToastMessage(message);
    setToastType(type);
    const normalized = normalizeDuration(duration ?? (type === 'success' ? SUCCESS_TOAST_DURATION_SECONDS : null));
    setToastDuration(normalized);
  };

  const hideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return { toastMessage, toastType, toastDuration, showToast, hideToast };
}
