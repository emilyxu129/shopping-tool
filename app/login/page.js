"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPassword(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not unlock the app.");
        return;
      }

      window.location.href = searchParams.get("next") || "/";
    } catch {
      setError("Could not unlock the app.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={submitPassword}>
        <div className="brand login-brand">
          <div className="brand-mark">ST</div>
          <div>Shopping Tool</div>
        </div>
        <h1>Enter app password</h1>
        <input
          autoComplete="current-password"
          autoFocus
          className="url-input"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          value={password}
        />
        {error ? <div className="login-error">{error}</div> : null}
        <button className="btn primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Unlocking" : "Unlock"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
