"use client";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, ...inputProps }: TextFieldProps) {
  return (
    <div>
      <label className="block text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        {...inputProps}
        className="w-full rounded-lg bg-surface-container-high/60 border border-white/10 px-4 py-2 text-on-surface font-mono text-label-md focus:outline-none focus:border-pokeball-red focus:ring-1 focus:ring-pokeball-red placeholder:text-on-surface-variant/40"
      />
      {hint && <p className="mt-1 text-label-sm text-on-surface-variant/60">{hint}</p>}
    </div>
  );
}
