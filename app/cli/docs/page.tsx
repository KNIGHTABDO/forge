'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DocsPage from './[...slug]/page';

export default function DocsIndex() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/cli/docs') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const target = `/desktop/docs${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, [pathname]);

  return <DocsPage />;
}