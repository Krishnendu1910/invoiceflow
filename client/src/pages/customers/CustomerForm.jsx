import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { customerApi } from "../../api/customerApi";
import { parseErrorMessage, parseFieldErrors } from "../../api/errors";
import { useBusiness } from "../../context/useBusiness";
import FormField from "../../components/FormField";
import SelectField from "../../components/SelectField";
import TextareaField from "../../components/TextareaField";
import TagInput from "../../components/TagInput";
import AddressFields from "../../components/AddressFields";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import FullPageSpinner from "../../components/FullPageSpinner";

const emptyAddress = { line1: "", line2: "", city: "", state: "", postalCode: "", country: "" };

const emptyForm = {
  type: "individual",
  name: "",
  companyName: "",
  email: "",
  phone: "",
  tax: { gstRegistered: false, gstin: "", pan: "" },
  billingAddress: { ...emptyAddress },
  shippingAddress: { ...emptyAddress },
  tags: [],
  notes: "",
};

function customerToForm(customer) {
  return {
    type: customer.type,
    name: customer.name,
    companyName: customer.companyName || "",
    email: customer.email || "",
    phone: customer.phone || "",
    tax: {
      gstRegistered: customer.tax?.gstRegistered || false,
      gstin: customer.tax?.gstin || "",
      pan: customer.tax?.pan || "",
    },
    billingAddress: { ...emptyAddress, ...(customer.billingAddress || {}) },
    shippingAddress: { ...emptyAddress, ...(customer.shippingAddress || {}) },
    tags: customer.tags || [],
    notes: customer.notes || "",
  };
}

export default function CustomerForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { businessId } = useBusiness();

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(isEdit ? "loading" : "ready");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [recordStatus, setRecordStatus] = useState("active");
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    customerApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setForm(customerToForm(res.data.customer));
        setRecordStatus(res.data.customer.status);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(parseErrorMessage(err, "Could not load this customer."));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setTax(field, value) {
    setForm((prev) => ({ ...prev, tax: { ...prev.tax, [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setFieldErrors({});

    try {
      if (isEdit) {
        const res = await customerApi.update(id, form);
        setForm(customerToForm(res.data.customer));
      } else {
        const res = await customerApi.create({ businessId, ...form });
        navigate(`/customers/${res.data.customer.id}`, { replace: true });
      }
    } catch (err) {
      setFieldErrors(parseFieldErrors(err));
      setSaveError(parseErrorMessage(err, "Could not save this customer."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const res =
        pendingAction === "archive" ? await customerApi.archive(id) : await customerApi.restore(id);
      setRecordStatus(res.data.customer.status);
      setPendingAction(null);
    } catch (err) {
      setSaveError(parseErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (status === "loading") {
    return <FullPageSpinner />;
  }

  if (status === "error") {
    return <Alert variant="error">{loadError}</Alert>;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{isEdit ? "Edit customer" : "New customer"}</h1>
        {isEdit && <StatusBadge status={recordStatus} />}
      </div>

      <Alert variant="error">{saveError}</Alert>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Basic details</h2>

          <SelectField label="Customer type" required value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </SelectField>

          <FormField
            label="Name"
            required
            value={form.name}
            error={fieldErrors.name}
            onChange={(e) => set("name", e.target.value)}
          />

          {form.type === "business" && (
            <FormField
              label="Company name"
              value={form.companyName}
              error={fieldErrors.companyName}
              onChange={(e) => set("companyName", e.target.value)}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Email"
              type="email"
              value={form.email}
              error={fieldErrors.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <FormField
              label="Phone"
              value={form.phone}
              error={fieldErrors.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tax information</h2>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.tax.gstRegistered}
              onChange={(e) => setTax("gstRegistered", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            GST registered
          </label>

          {form.tax.gstRegistered && (
            <FormField
              label="GSTIN"
              required
              value={form.tax.gstin}
              error={fieldErrors["tax.gstin"]}
              onChange={(e) => setTax("gstin", e.target.value)}
            />
          )}

          <FormField
            label="PAN"
            value={form.tax.pan}
            error={fieldErrors["tax.pan"]}
            onChange={(e) => setTax("pan", e.target.value)}
          />
        </section>

        <AddressFields
          label="Billing address"
          value={form.billingAddress}
          onChange={(value) => set("billingAddress", value)}
        />

        <div>
          <button
            type="button"
            onClick={() => set("shippingAddress", { ...form.billingAddress })}
            className="mb-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Copy billing address
          </button>
          <AddressFields
            label="Shipping address"
            value={form.shippingAddress}
            onChange={(value) => set("shippingAddress", value)}
          />
        </div>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tags & notes</h2>
          <TagInput value={form.tags} onChange={(value) => set("tags", value)} />
          <TextareaField label="Notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </section>

        <div className="flex items-center justify-between">
          <Button type="submit" className="w-auto" loading={saving}>
            {isEdit ? "Save changes" : "Create customer"}
          </Button>

          {isEdit &&
            (recordStatus === "active" ? (
              <Button type="button" variant="secondary" className="w-auto" onClick={() => setPendingAction("archive")}>
                Archive customer
              </Button>
            ) : (
              <Button type="button" variant="secondary" className="w-auto" onClick={() => setPendingAction("restore")}>
                Restore customer
              </Button>
            ))}
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction === "archive" ? "Archive this customer?" : "Restore this customer?"}
        message={
          pendingAction === "archive"
            ? "Archived customers are hidden from active lists but kept for historical documents."
            : "This customer will become active again."
        }
        confirmLabel={pendingAction === "archive" ? "Archive" : "Restore"}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
