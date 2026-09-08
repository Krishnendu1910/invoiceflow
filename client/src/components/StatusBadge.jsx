// Visually distinguishes archived records wherever a status appears (lists,
// detail headers).
export default function StatusBadge({ status }) {
  const styles = status === "archived" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}>{status}</span>;
}
