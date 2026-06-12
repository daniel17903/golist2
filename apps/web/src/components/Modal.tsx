import type { FormEvent, MouseEvent, ReactNode } from "react";

type ModalProps = {
  title?: string;
  onClose: () => void;
  actions: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  // When provided the modal renders as a <form> so Enter submits.
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation();
};

const Modal = ({ title, onClose, actions, children, bodyClassName, onSubmit }: ModalProps) => {
  const header = title ? (
    <div className="modal__header">
      <h2>{title}</h2>
    </div>
  ) : null;
  const body = <div className={bodyClassName ? `modal__body ${bodyClassName}` : "modal__body"}>{children}</div>;
  const footer = <div className="modal__actions">{actions}</div>;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      {onSubmit ? (
        <form className="modal" onSubmit={onSubmit} onClick={stopPropagation}>
          {header}
          {body}
          {footer}
        </form>
      ) : (
        <div className="modal" onClick={stopPropagation}>
          {header}
          {body}
          {footer}
        </div>
      )}
    </div>
  );
};

export default Modal;
