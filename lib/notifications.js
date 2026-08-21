import { sendEmail } from "./email";

const IGNORED_STARTING_VALUES = new Set([
  "",
  "Unknown",
  "Waiting for scraper",
  "None yet",
]);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getNotificationChanges(beforeProduct, afterProduct) {
  const changes = [];

  if (
    beforeProduct.currentPrice !== afterProduct.currentPrice &&
    !IGNORED_STARTING_VALUES.has(beforeProduct.currentPrice) &&
    !IGNORED_STARTING_VALUES.has(afterProduct.currentPrice)
  ) {
    changes.push(
      `Price changed from ${beforeProduct.currentPrice} to ${afterProduct.currentPrice}.`,
    );
  }

  if (
    beforeProduct.stock !== afterProduct.stock &&
    !IGNORED_STARTING_VALUES.has(beforeProduct.stock) &&
    !IGNORED_STARTING_VALUES.has(afterProduct.stock)
  ) {
    changes.push(`Stock changed from ${beforeProduct.stock} to ${afterProduct.stock}.`);
  }

  return changes;
}

export async function sendProductChangeEmail(beforeProduct, afterProduct) {
  const changes = getNotificationChanges(beforeProduct, afterProduct);

  if (changes.length === 0) {
    return { sent: false };
  }

  const subject = `Shopping Tool alert: ${afterProduct.title}`;
  const text = [
    afterProduct.title,
    "",
    ...changes,
    "",
    `Tracked size: ${afterProduct.trackedSize || afterProduct.size || "Unknown"}`,
    `Tracked specs: ${afterProduct.variantSpecs || "None"}`,
    `Product link: ${afterProduct.url}`,
  ].join("\n");
  const html = `
    <h1>${escapeHtml(afterProduct.title)}</h1>
    <ul>
      ${changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}
    </ul>
    <p><strong>Tracked size:</strong> ${escapeHtml(
      afterProduct.trackedSize || afterProduct.size || "Unknown",
    )}</p>
    <p><strong>Tracked specs:</strong> ${escapeHtml(
      afterProduct.variantSpecs || "None",
    )}</p>
    <p><a href="${escapeHtml(afterProduct.url)}">Open product</a></p>
  `;

  const data = await sendEmail({ subject, html, text });

  return { sent: true, id: data.id, changes };
}
