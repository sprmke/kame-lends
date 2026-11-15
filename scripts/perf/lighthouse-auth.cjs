/**
 * Give Lighthouse an authenticated session so it measures the real dashboard,
 * not the sign-in redirect. Runs before each URL collection.
 */
module.exports = async (browser) => {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) return;

  const response = await fetch("http://localhost:4174/api/e2e/session", {
    method: "POST",
    headers: { "x-e2e-auth-secret": secret },
  });
  if (!response.ok) {
    throw new Error(`Lighthouse auth failed: ${response.status}`);
  }

  const setCookie = response.headers.getSetCookie?.()[0];
  if (!setCookie) return;
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  if (separator <= 0) return;
  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();

  await browser.setCookie({
    name,
    value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
};
