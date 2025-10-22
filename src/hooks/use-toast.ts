import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
}

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = Toast & {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
};

export function useToast() {
  const [toasts, setToasts] = useState<ToasterToast[]>([]);

  const toast = useCallback(({ ...props }: Omit<ToasterToast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast: ToasterToast = {
      ...props,
      id,
    };

    setToasts((prevToasts) => {
      const updatedToasts = [...prevToasts, newToast];
      if (updatedToasts.length > TOAST_LIMIT) {
        return updatedToasts.slice(-TOAST_LIMIT);
      }
      return updatedToasts;
    });

    setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
    }, TOAST_REMOVE_DELAY);

    return {
      id,
      dismiss: () => {
        setToasts((prevToasts) => prevToasts.filter((t) => t.id !== id));
      },
      update: (props: Partial<ToasterToast>) => {
        setToasts((prevToasts) =>
          prevToasts.map((t) => (t.id === id ? { ...t, ...props } : t))
        );
      },
    };
  }, []);

  const dismiss = useCallback((toastId?: string) => {
    setToasts((prevToasts) =>
      toastId ? prevToasts.filter((t) => t.id !== toastId) : []
    );
  }, []);

  return {
    toasts,
    toast,
    dismiss,
  };
}
