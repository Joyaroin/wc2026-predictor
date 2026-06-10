import { flagUrls } from '../lib/flags';

/** A small country flag for a FIFA team code; renders nothing for unknown/placeholder teams. */
export function Flag({ code, name, big = false }: { code: string | null | undefined; name: string; big?: boolean }) {
  const f = flagUrls(code);
  if (!f) return null;
  const w = big ? 34 : 24;
  const h = big ? 26 : 18;
  return (
    <img className={big ? 'flag flag-big' : 'flag'} src={f.src} srcSet={f.srcSet} width={w} height={h} alt="" title={name} loading="lazy" />
  );
}
