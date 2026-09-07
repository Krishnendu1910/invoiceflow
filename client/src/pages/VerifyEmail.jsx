import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { authApi } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import Alert from "../components/Alert";
import Button from "../components/Button";
import FormField from "../components/FormField";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get("token");

  const [status, setStatus] = useState(token ? "verifying" : "awaiting");
  const [error, setError] = useState("");

  const [resendEmail, setResendEmail] = useState(location.state?.email || "");
  const [resendStatus, setResendStatus] = useState("idle");

  useEffect(() => {
    if (!token) return;

    authApi
      .verifyEmail(token)
      .then(() => setStatus("verified"))
      .catch((err) => {
        setStatus("failed");
        setError(err.response?.data?.message || "This verification link is invalid or has expired.");
      });
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    setResendStatus("sending");
    try {
      await authApi.resendVerification(resendEmail);
      setResendStatus("sent");
    } catch {
      setResendStatus("sent"); // Response is intentionally generic; treat the same either way.
    }
  }

  if (status === "verifying") {
    return (
      <AuthLayout title="Verifying your email...">
        <p className="text-sm text-slate-500">One moment.</p>
      </AuthLayout>
    );
  }

  if (status === "verified") {
    return (
      <AuthLayout title="Email verified" footer={<Link to="/login" className="font-medium text-indigo-600 hover:underline">Go to login</Link>}>
        <Alert variant="success">Your email address has been verified. You can now log in.</Alert>
      </AuthLayout>
    );
  }

  if (status === "failed") {
    return (
      <AuthLayout title="Verification failed">
        <Alert variant="error">{error}</Alert>
        <form className="space-y-4" onSubmit={handleResend}>
          <FormField
            label="Email"
            type="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
          />
          <Button type="submit" loading={resendStatus === "sending"}>
            Resend verification email
          </Button>
        </form>
        {resendStatus === "sent" && (
          <Alert variant="success">If an account exists with that email, a new verification link has been sent.</Alert>
        )}
      </AuthLayout>
    );
  }

  // status === "awaiting": user just registered and has no token yet.
  return (
    <AuthLayout title="Check your email" subtitle="We've sent a verification link to your inbox.">
      <p className="mb-4 text-sm text-slate-500">
        Click the link in the email to verify {resendEmail ? <strong>{resendEmail}</strong> : "your account"}. You can
        log in before verifying, but some actions require a verified email.
      </p>
      <form className="space-y-4" onSubmit={handleResend}>
        <FormField
          label="Didn't get it? Resend to:"
          type="email"
          required
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
        />
        <Button type="submit" variant="secondary" loading={resendStatus === "sending"}>
          Resend verification email
        </Button>
      </form>
      {resendStatus === "sent" && (
        <Alert variant="success">If an account exists with that email, a new verification link has been sent.</Alert>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
