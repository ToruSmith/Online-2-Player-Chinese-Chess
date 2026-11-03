import { type ReactNode, useEffect, useRef } from 'react';

interface DialogProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
}

/** 使用原生 <dialog>，自動處理焦點鎖定與 Esc。 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
    >
      {children}
    </dialog>
  );
}
