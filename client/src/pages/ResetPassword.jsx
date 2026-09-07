import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import Button from "../components/Button";
import Alert from "../components/Alert";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing its token. Please request a new one.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.response?.data?.message || "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      footer={
        <Link to="/forgot-password" className="font-medium text-indigo-600 hover:underline">
          Request a new link
        </Link>
      }
    >
      <Alert variant="error">{error}</Alert>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-slate-400">Must be 8-128 characters. This will end all of your active sessions.</p>
        <Button type="submit" loading={loading}>
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
