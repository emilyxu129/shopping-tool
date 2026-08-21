const RESEND_SEND_EMAIL_URL = "https://api.resend.com/emails";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);
}

export async function sendEmail({ subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY in .env.local.");
  }

  if (!process.env.ALERT_EMAIL_TO) {
    throw new Error("Missing ALERT_EMAIL_TO in .env.local.");
  }

  const response = await fetch(RESEND_SEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "ShoppingTool/0.1",
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || "Shopping Tool <onboarding@resend.dev>",
      to: [process.env.ALERT_EMAIL_TO],
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Resend could not send the email.");
  }

  return data;
}
