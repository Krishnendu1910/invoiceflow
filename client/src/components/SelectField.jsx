export default function SelectField({ label, error, children, ...selectProps }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        {...selectProps}
        className={`mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 ${
          error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-indigo-500"
        }`}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
