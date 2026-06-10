import { flagUrls } from '../lib/flags';

/** A small country flag for a FIFA team code; renders nothing for unknown/placeholder teams. */
export function Flag({ code, name }: { code: string | null | undefined; name: string }) {
  const f = flagUrls(code);
  if (!f) return null;
  return (
    <img className="flag" src={f.src} srcSet={f.srcSet} width={24} height={18} alt="" title={name} loading="lazy" />
  );
}
