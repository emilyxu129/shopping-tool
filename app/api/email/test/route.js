import { sendEmail } from "../../../../lib/email";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await sendEmail({
      subject: "Shopping Tool test email",
      html: `
        <h1>Shopping Tool email is working</h1>
        <p>This is a local test from your product tracker.</p>
      `,
      text: "Shopping Tool email is working. This is a local test from your product tracker.",
    });

    return Response.json({ ok: true, id: data.id });
  } catch (error) {
    return Response.json(
      { error: error.message || "Could not send test email." },
      { status: 400 },
    );
  }
}
