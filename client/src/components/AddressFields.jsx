import FormField from "./FormField";

export default function AddressFields({ label, value, onChange }) {
  function set(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>

      <FormField label="Address line 1" value={value.line1 || ""} onChange={(e) => set("line1", e.target.value)} />
      <FormField label="Address line 2" value={value.line2 || ""} onChange={(e) => set("line2", e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <FormField label="City" value={value.city || ""} onChange={(e) => set("city", e.target.value)} />
        <FormField label="State" value={value.state || ""} onChange={(e) => set("state", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Postal code"
          value={value.postalCode || ""}
          onChange={(e) => set("postalCode", e.target.value)}
        />
        <FormField
          label="Country (2-letter code)"
          maxLength={2}
          value={value.country || ""}
          onChange={(e) => set("country", e.target.value.toUpperCase())}
        />
      </div>
    </fieldset>
  );
}
