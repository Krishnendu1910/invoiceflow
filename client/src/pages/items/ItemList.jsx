import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { itemApi } from "../../api/itemApi";
import { parseErrorMessage } from "../../api/errors";
import { useBusiness } from "../../context/useBusiness";
import SearchInput from "../../components/SearchInput";
import SegmentedControl from "../../components/SegmentedControl";
import Pagination from "../../components/Pagination";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import Alert from "../../components/Alert";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
];

export default function ItemList() {
  const { businessId } = useBusiness();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState("loading");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Runs the fetch itself with no synchronous setState before the async
  // call — only the .then/.catch callbacks update state, so this effect
  // doesn't trigger a cascading render. The "show loading text" transition
  // for a retry-after-error is handled by the filter/page handlers below,
  // which are event handlers and may set state directly.
  const load = useCallback(() => {
    itemApi
      .list({ businessId, search, status, type, page, limit: 20 })
      .then((res) => {
        setItems(res.data.items);
        setPagination(res.data.pagination);
        setLoadState("ready");
        setError("");
      })
      .catch((err) => {
        setError(parseErrorMessage(err, "Could not load items."));
        setLoadState("error");
      });
  }, [businessId, search, status, type, page]);

  useEffect(() => {
    load();
  }, [load]);

  function retryIfErrored() {
    setLoadState((prev) => (prev === "error" ? "loading" : prev));
  }

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
    retryIfErrored();
  }

  function handleStatusChange(value) {
    setStatus(value);
    setPage(1);
    retryIfErrored();
  }

  function handleTypeChange(value) {
    setType(value);
    setPage(1);
    retryIfErrored();
  }

  function handlePageChange(value) {
    setPage(value);
    retryIfErrored();
  }

  function requestAction(item, action) {
    setActionError("");
    setPendingAction({ item, action });
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    setActionError("");
    try {
      const { item, action } = pendingAction;
      await (action === "archive" ? itemApi.archive(item.id) : itemApi.restore(item.id));
      setPendingAction(null);
      load();
    } catch (err) {
      setActionError(parseErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  const hasFilters = Boolean(search) || status !== "active" || Boolean(type);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Items</h1>
        <Link
          to="/items/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New item
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={handleSearchChange} placeholder="Search name, SKU, HSN/SAC..." />
        <SegmentedControl value={status} onChange={handleStatusChange} options={STATUS_OPTIONS} />
        <SegmentedControl value={type} onChange={handleTypeChange} options={TYPE_OPTIONS} />
      </div>

      <Alert variant="error">{error || actionError}</Alert>

      {loadState === "loading" && <p className="text-sm text-slate-500">Loading items...</p>}

      {loadState !== "loading" && items.length === 0 && (
        <EmptyState
          title="No items found"
          message={hasFilters ? "Try adjusting your search or filters." : "Add your first product or service to get started."}
          action={
            !hasFilters && (
              <Link
                to="/items/new"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                New item
              </Link>
            )
          }
        />
      )}

      {loadState !== "loading" && items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU / HSN</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className={item.status === "archived" ? "bg-slate-50/60" : ""}>
                  <td className="px-4 py-3">
                    <Link to={`/items/${item.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{item.sku}</div>
                    <div className="text-xs text-slate-400">{item.hsnSac}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{item.type}</td>
                  <td className="px-4 py-3 text-slate-600">{item.rate}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => requestAction(item, "archive")}
                        className="text-sm font-medium text-slate-500 hover:text-red-600"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestAction(item, "restore")}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={handlePageChange} />
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action === "archive" ? "Archive this item?" : "Restore this item?"}
        message={
          pendingAction?.action === "archive"
            ? "Archived items are hidden from active selection but kept for historical documents. You can restore them anytime."
            : "This item will become active again and appear in active selection."
        }
        confirmLabel={pendingAction?.action === "archive" ? "Archive" : "Restore"}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
