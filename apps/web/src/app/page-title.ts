import { useEffect } from 'react';
import { useBranding } from './branding';

/** Sets the browser tab title, e.g. "Purchase · Construction ERP" (WCAG 2.4.2). */
export function usePageTitle(title: string): void {
  const { productName } = useBranding();
  useEffect(() => {
    document.title = title ? `${title} · ${productName}` : productName;
  }, [title, productName]);
}
