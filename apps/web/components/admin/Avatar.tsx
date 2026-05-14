/**
 * Reusable avatar — shows photo if `src` provided, falls back to first-letter
 * circle in brand-50 background. Sized via `size` prop; deterministic styling
 * across the admin shell.
 */
interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** When true, applies a subtle ring — useful for hero/photo prominence. */
  ring?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, { box: string; text: string }> = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-10 w-10', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-xl' },
};

export function Avatar({ src, name, size = 'md', ring = false }: AvatarProps) {
  const { box, text } = SIZE_CLASSES[size];
  const initial = (name?.charAt(0) ?? '?').toUpperCase();
  const ringClass = ring ? 'ring-2 ring-white shadow-brand-low' : '';

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} 頭像`}
        className={`${box} ${ringClass} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${box} ${text} ${ringClass} flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
