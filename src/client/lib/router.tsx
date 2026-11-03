import { type AnchorHTMLAttributes, type MouseEvent, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

window.addEventListener('popstate', notify);

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.scrollTo(0, 0);
  notify();
}

export function usePathname(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => window.location.pathname,
  );
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, ...props }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (event.defaultPrevented || modified || event.button !== 0) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handleClick} {...props} />;
}
