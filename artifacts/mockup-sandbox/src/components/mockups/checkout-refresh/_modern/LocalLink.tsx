import type { ComponentProps } from 'react';

export function LocalLink({ href, onClick, ...props }: ComponentProps<'a'>) {
  return <a
    {...props}
    href={href ?? '#'}
    onClick={event => {
      onClick?.(event);
      event.preventDefault();
    }}
  />;
}