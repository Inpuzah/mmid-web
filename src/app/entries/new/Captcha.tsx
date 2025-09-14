"use client";

import Script from "next/script";

export default function Captcha() {
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY!;
  return (
    <>
      <Script src="https://hcaptcha.com/1/api.js" async defer />
      <div className="h-captcha" data-sitekey={siteKey} />
    </>
  );
}
