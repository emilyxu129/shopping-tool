export const AUTH_COOKIE_NAME = "shopping_tool_auth";
const AUTH_TOKEN_MESSAGE = "shopping-tool-authenticated";

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createAuthToken(password) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(AUTH_TOKEN_MESSAGE),
  );

  return bytesToHex(new Uint8Array(signature));
}
