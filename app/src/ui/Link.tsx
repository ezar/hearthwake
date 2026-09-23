// An <a> for in-app routes: a real link (keyboard, long press) that navigates without a reload.
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate, routeHash, type Route } from '../router';

export function Link({ to, onClick, ...rest }: { to: Route } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={routeHash(to)} onClick={handle} {...rest} />;
}
