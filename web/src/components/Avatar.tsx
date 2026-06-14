// Deterministic initials avatar — same name always gets the same colour.
const PALETTE = [
  '#00c389', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function avatarColor(name: string): string {
  return PALETTE[hash(name) % PALETTE.length]!;
}

export function Avatar({ name, size = 28, ring }: { name: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={`avatar${ring ? ' ring' : ''}`}
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping stack of avatars (e.g. group members), capped with a "+N". */
export function AvatarStack({ names, max = 5, size = 26 }: { names: string[]; max?: number; size?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((n, i) => (
        <span className="avatar-slot" style={{ marginLeft: i === 0 ? 0 : -size * 0.34 }} key={`${n}-${i}`}>
          <Avatar name={n} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span className="avatar-slot" style={{ marginLeft: -size * 0.34 }}>
          <span className="avatar more ring" style={{ width: size, height: size, fontSize: size * 0.36 }}>+{extra}</span>
        </span>
      )}
    </span>
  );
}
