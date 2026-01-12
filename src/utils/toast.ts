// src/utils/toast.ts
export type ToastType = 'success' | 'error';

export interface Toast {
  message: string;
  type: ToastType;
}

export const showToast = (
  setToast: React.Dispatch<React.SetStateAction<Toast | null>>,
  message: string,
  type: ToastType = 'success',
  duration = 3200
) => {
  setToast({ message, type });
  setTimeout(() => setToast(null), duration);
};
