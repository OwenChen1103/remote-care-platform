/**
 * Inline chip group for filtering admin list pages.
 *
 * Replaces native `<select>` for a more modern, scannable filter UI. Each chip
 * shows the option label; active chip is filled with brand color, inactive
 * chips are bordered with subtle hover state.
 *
 * Best for filters with ≤ 6 options. For longer lists (e.g. status with 9
 * service-request states), an option group toggle is still acceptable.
 */
interface FilterChipsProps {
  /** Inline label shown before the chips. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function FilterChips({ label, value, onChange, options }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-ink-500">{label}</span>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
              active
                ? 'bg-brand-500 text-white shadow-brand-low'
                : 'border border-outline bg-white text-ink-700 hover:border-brand-200 hover:bg-brand-50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
