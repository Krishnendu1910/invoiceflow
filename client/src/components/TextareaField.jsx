export default function TextareaField({ label, error, ...textareaProps }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        {...textareaProps}
        className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 ${
          error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-indigo-500"
        }`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
