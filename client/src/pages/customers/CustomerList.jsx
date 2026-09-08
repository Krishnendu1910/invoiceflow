import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { customerApi } from "../../api/customerApi";
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
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
];

export default function CustomerList() {
  const { businessId } = useBusiness();
  const [customers, setCustomers] = useState([]);
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
    customerApi
      .list({ businessId, search, status, type, page, limit: 20 })
      .then((res) => {
        setCustomers(res.data.customers);
        setPagination(res.data.pagination);
        setLoadState("ready");
        setError("");
      })
      .catch((err) => {
        setError(parseErrorMessage(err, "Could not load customers."));
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

  function requestAction(customer, action) {
    setActionError("");
    setPendingAction({ customer, action });
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    setActionError("");
    try {
      const { customer, action } = pendingAction;
      await (action === "archive" ? customerApi.archive(customer.id) : customerApi.restore(customer.id));
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
        <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
        <Link
          to="/customers/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          New customer
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={handleSearchChange} placeholder="Search name, company, email, phone..." />
        <SegmentedControl value={status} onChange={handleStatusChange} options={STATUS_OPTIONS} />
        <SegmentedControl value={type} onChange={handleTypeChange} options={TYPE_OPTIONS} />
      </div>

      <Alert variant="error">{error || actionError}</Alert>

      {loadState === "loading" && <p className="text-sm text-slate-500">Loading customers...</p>}

      {loadState !== "loading" && customers.length === 0 && (
        <EmptyState
          title="No customers found"
          message={hasFilters ? "Try adjusting your search or filters." : "Add your first customer to get started."}
          action={
            !hasFilters && (
              <Link
                to="/customers/new"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                New customer
              </Link>
            )
          }
        />
      )}

      {loadState !== "loading" && customers.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <tr key={customer.id} className={customer.status === "archived" ? "bg-slate-50/60" : ""}>
                  <td className="px-4 py-3">
                    <Link to={`/customers/${customer.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {customer.name}
                    </Link>
                    {customer.companyName && <div className="text-xs text-slate-500">{customer.companyName}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{customer.email}</div>
                    <div>{customer.phone}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{customer.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={customer.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {customer.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => requestAction(customer, "archive")}
                        className="text-sm font-medium text-slate-500 hover:text-red-600"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestAction(customer, "restore")}
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
        title={pendingAction?.action === "archive" ? "Archive this customer?" : "Restore this customer?"}
        message={
          pendingAction?.action === "archive"
            ? "Archived customers are hidden from active lists but kept for historical documents. You can restore them anytime."
            : "This customer will become active again and appear in active lists."
        }
        confirmLabel={pendingAction?.action === "archive" ? "Archive" : "Restore"}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
