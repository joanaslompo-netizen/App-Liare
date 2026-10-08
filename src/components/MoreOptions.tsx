import React from 'react';

/** Native disclosure keeps form controls mounted and preserves unsaved values. */
export function MoreOptions({ title = 'Mais opções', children, defaultOpen = false }: {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen || undefined} className="liare-more-options rounded-xl border border-stone-200 bg-white p-3">
      <summary className="cursor-pointer py-2 text-sm font-semibold text-stone-800 focus-visible:outline-2 focus-visible:outline-amber-500">
        {title}
      </summary>
      <div className="pt-3 space-y-4">{children}</div>
    </details>
  );
}
