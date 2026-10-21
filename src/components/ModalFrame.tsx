import React, { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ModalFrameProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onClose'> & {
  onClose: () => void;
  embedded?: boolean;
};

let openModals = 0;

/** One viewport and scroll layout for every popup, including nested windows. */
export function ModalFrame({ onClose, embedded = false, children, className = '', ...props }: ModalFrameProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = dialog.current;
    if (embedded || !element) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      element.style.setProperty('--modal-height', `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty('--modal-width', `${viewport?.width ?? window.innerWidth}px`);
      element.style.setProperty('--modal-top', `${viewport?.offsetTop ?? 0}px`);
      element.style.setProperty('--modal-left', `${viewport?.offsetLeft ?? 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);

    if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
      const title = element.querySelector<HTMLElement>('h1,h2,h3,h4');
      if (title) {
        if (!title.id) title.id = titleId;
        element.setAttribute('aria-labelledby', title.id);
      }
    }
    openModals += 1;
    document.body.classList.add('liare-modal-open');
    // Native dialogs escape clipping/stacking ancestors and keep focus in the top window.
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      if (typeof element.close === 'function') element.close();
      openModals -= 1;
      if (openModals === 0) document.body.classList.remove('liare-modal-open');
    };
  }, [embedded, titleId]);

  if (embedded) return <div className={className} {...props}>{children}</div>;
  const panel = React.Children.map(children, child => React.isValidElement<{ className?: string }>(child)
    ? React.cloneElement(child, { className: `${child.props.className ?? ''} liare-modal-panel` })
    : child);
  return createPortal(<dialog
    {...props as React.HTMLAttributes<HTMLDialogElement>}
    ref={dialog}
    aria-modal="true"
    className={`liare-modal-overlay ${className}`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
  >{panel}</dialog>, document.body);
}
