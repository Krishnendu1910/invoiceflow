import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { itemApi } from "../../api/itemApi";
import { parseErrorMessage, parseFieldErrors } from "../../api/errors";
import { useBusiness } from "../../context/useBusiness";
import FormField from "../../components/FormField";
import SelectField from "../../components/SelectField";
import TextareaField from "../../components/TextareaField";
import TagInput from "../../components/TagInput";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import FullPageSpinner from "../../components/FullPageSpinner";

const UNIT_SUGGESTIONS = ["pcs", "kg", "g", "litre", "metre", "hour", "day", "month", "box", "set"];

const emptyForm = {
  type: "product",
  name: "",
  description: "",
  sku: "",
  hsnSac: "",
  unit: "",
  rate: "",
  defaultTax: { type: "none", rate: 0, label: "" },
  defaultDiscount: { type: "none", value: 0, label: "" },
  tags: [],
  notes: "",
};

function itemToForm(item) {
  return {
    type: item.type,
    name: item.name,
    description: item.description || "",
    sku: item.sku || "",
    hsnSac: item.hsnSac || "",
    unit: item.unit || "",
    rate: item.rate,
    defaultTax: {
      type: item.defaultTax?.type || "none",
      rate: item.defaultTax?.rate ?? 0,
      label: item.defaultTax?.label || "",
    },
    defaultDiscount: {
      type: item.defaultDiscount?.type || "none",
      value: item.defaultDiscount?.value ?? 0,
      label: item.defaultDiscount?.label || "",
    },
    tags: item.tags || [],
    notes: item.notes || "",
  };
}

export default function ItemForm() {
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

    itemApi
      .get(id)
      .then((res) => {
        if (cancelled) return;
        setForm(itemToForm(res.data.item));
        setRecordStatus(res.data.item.status);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(parseErrorMessage(err, "Could not load this item."));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setDefaultTax(field, value) {
    setForm((prev) => ({ ...prev, defaultTax: { ...prev.defaultTax, [field]: value } }));
  }

  function setDefaultDiscount(field, value) {
    setForm((prev) => ({ ...prev, defaultDiscount: { ...prev.defaultDiscount, [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");
    setFieldErrors({});

    try {
      const payload = { ...form, rate: form.rate === "" ? undefined : Number(form.rate) };
      if (isEdit) {
        const res = await itemApi.update(id, payload);
        setForm(itemToForm(res.data.item));
      } else {
        const res = await itemApi.create({ businessId, ...payload });
        navigate(`/items/${res.data.item.id}`, { replace: true });
      }
    } catch (err) {
      setFieldErrors(parseFieldErrors(err));
      setSaveError(parseErrorMessage(err, "Could not save this item."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const res = pendingAction === "archive" ? await itemApi.archive(id) : await itemApi.restore(id);
      setRecordStatus(res.data.item.status);
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
        <h1 className="text-xl font-semibold text-slate-900">{isEdit ? "Edit item" : "New item"}</h1>
        {isEdit && <StatusBadge status={recordStatus} />}
      </div>

      <Alert variant="error">{saveError}</Alert>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Basic details</h2>

          <SelectField label="Type" required value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </SelectField>

          <FormField
            label="Name"
            required
            value={form.name}
            error={fieldErrors.name}
            onChange={(e) => set("name", e.target.value)}
          />

          <TextareaField
            label="Description"
            rows={3}
            value={form.description}
            error={fieldErrors.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="SKU"
              value={form.sku}
              error={fieldErrors.sku}
              onChange={(e) => set("sku", e.target.value)}
            />
            <FormField
              label="HSN/SAC"
              value={form.hsnSac}
              error={fieldErrors.hsnSac}
              onChange={(e) => set("hsnSac", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Unit</span>
              <input
                list="unit-suggestions"
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="e.g. pcs, hour, box"
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/40 ${
                  fieldErrors.unit ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-indigo-500"
                }`}
              />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              {fieldErrors.unit && <span className="mt-1 block text-xs text-red-600">{fieldErrors.unit}</span>}
            </label>

            <FormField
              label="Rate"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.rate}
              error={fieldErrors.rate}
              onChange={(e) => set("rate", e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Default tax</h2>
          <p className="text-xs text-slate-500">
            Applied by default on invoice/quotation line items using this item. Can be overridden per line later.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <SelectField
              label="Type"
              value={form.defaultTax.type}
              onChange={(e) => setDefaultTax("type", e.target.value)}
            >
              <option value="none">None</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </SelectField>
            <FormField
              label="Rate"
              type="number"
              min="0"
              step="0.01"
              disabled={form.defaultTax.type === "none"}
              value={form.defaultTax.rate}
              error={fieldErrors["defaultTax.rate"]}
              onChange={(e) => setDefaultTax("rate", e.target.value)}
            />
            <FormField
              label="Label"
              disabled={form.defaultTax.type === "none"}
              value={form.defaultTax.label}
              onChange={(e) => setDefaultTax("label", e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Default discount</h2>
          <p className="text-xs text-slate-500">
            Applied by default on invoice/quotation line items using this item. Can be overridden per line later.
          </p>

          <div className="grid grid-cols-3 gap-4">
            <SelectField
              label="Type"
              value={form.defaultDiscount.type}
              onChange={(e) => setDefaultDiscount("type", e.target.value)}
            >
              <option value="none">None</option>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </SelectField>
            <FormField
              label="Value"
              type="number"
              min="0"
              step="0.01"
              disabled={form.defaultDiscount.type === "none"}
              value={form.defaultDiscount.value}
              error={fieldErrors["defaultDiscount.value"]}
              onChange={(e) => setDefaultDiscount("value", e.target.value)}
            />
            <FormField
              label="Label"
              disabled={form.defaultDiscount.type === "none"}
              value={form.defaultDiscount.label}
              onChange={(e) => setDefaultDiscount("label", e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Tags & notes</h2>
          <TagInput value={form.tags} onChange={(value) => set("tags", value)} />
          <TextareaField label="Notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </section>

        <div className="flex items-center justify-between">
          <Button type="submit" className="w-auto" loading={saving}>
            {isEdit ? "Save changes" : "Create item"}
          </Button>

          {isEdit &&
            (recordStatus === "active" ? (
              <Button type="button" variant="secondary" className="w-auto" onClick={() => setPendingAction("archive")}>
                Archive item
              </Button>
            ) : (
              <Button type="button" variant="secondary" className="w-auto" onClick={() => setPendingAction("restore")}>
                Restore item
              </Button>
            ))}
        </div>
      </form>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction === "archive" ? "Archive this item?" : "Restore this item?"}
        message={
          pendingAction === "archive"
            ? "Archived items are hidden from active selection but kept for historical documents."
            : "This item will become active again."
        }
        confirmLabel={pendingAction === "archive" ? "Archive" : "Restore"}
        loading={actionLoading}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
