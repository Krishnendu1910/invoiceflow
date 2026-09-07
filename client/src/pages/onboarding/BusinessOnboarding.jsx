import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { businessApi } from "../../api/businessApi";
import { useAuth } from "../../context/useAuth";
import AuthLayout from "../../components/AuthLayout";
import FormField from "../../components/FormField";
import Button from "../../components/Button";
import Alert from "../../components/Alert";

// Suggestions only, offered via a <datalist> — the field itself accepts any
// free-text value the user types.
const SUGGESTED_BUSINESS_TYPES = ["Freelancer", "Shop / Retail", "Agency", "Service provider", "Other"];

// India-first: INR is the default currency, but the field is a plain code +
// symbol pair so any currency can be entered without a code change later.
export default function BusinessOnboarding() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    type: "",
    country: "IN",
    currencyCode: "INR",
    currencySymbol: "₹",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await businessApi.create({
        name: form.name,
        type: form.type,
        country: form.country,
        currency: { code: form.currencyCode, symbol: form.currencySymbol },
      });
      await refreshUser();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not create your business. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Set up your business" subtitle="This becomes your default business. You can add more later.">
      <Alert variant="error">{error}</Alert>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField
          label="Business name"
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <FormField
          label="Business type"
          type="text"
          list="business-type-suggestions"
          placeholder="e.g. Freelancer, Shop / Retail, Agency..."
          required
          maxLength={50}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        />
        <datalist id="business-type-suggestions">
          {SUGGESTED_BUSINESS_TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <FormField
          label="Country (2-letter code)"
          type="text"
          required
          maxLength={2}
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Currency code"
            type="text"
            required
            maxLength={3}
            value={form.currencyCode}
            onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })}
          />
          <FormField
            label="Currency symbol"
            type="text"
            required
            maxLength={5}
            value={form.currencySymbol}
            onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
          />
        </div>

        <Button type="submit" loading={loading}>
          Create business
        </Button>
      </form>
    </AuthLayout>
  );
}
