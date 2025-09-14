// src/lib/captcha.ts
export async function verifyHCaptcha(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) throw new Error("HCAPTCHA_SECRET_KEY is not set");

  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // Avoid caching verification responses
    cache: "no-store",
  });

  if (!res.ok) return false;
  const data: any = await res.json();
  return Boolean(data?.success);
}
