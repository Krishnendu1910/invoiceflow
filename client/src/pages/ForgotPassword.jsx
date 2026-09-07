import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import FormField from "../components/FormField";
import Button from "../components/Button";
import Alert from "../components/Alert";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      // The endpoint deliberately gives the same response either way, so
      // there is no error branch that reveals whether the email exists.
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Back to login
        </Link>
      }
    >
      {sent ? (
        <Alert variant="success">If an account exists with that email, a password reset link has been sent.</Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
