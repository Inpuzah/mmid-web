"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    hcaptcha?: any;
    hcaptchaOnVerify?: (token: string) => void;
    hcaptchaOnExpire?: () => void;
  }
}

export default function HcaptchaField({
  siteKey,
  inputName = "hcaptcha_token",
  theme = "dark",
}: {
  siteKey: string;
  inputName?: string;
  theme?: "light" | "dark";
}) {
  const [token, setToken] = useState("");

  useEffect(() => {
    window.hcaptchaOnVerify = (t: string) => setToken(t);
    window.hcaptchaOnExpire = () => setToken("");
    return () => {
      delete window.hcaptchaOnVerify;
      delete window.hcaptchaOnExpire;
    };
  }, []);

  return (
    <div className="grid gap-2">
      <Script src="https://js.hcaptcha.com/1/api.js" strategy="afterInteractive" />
      <div
        className="h-captcha"
        data-sitekey={siteKey}
        data-callback="hcaptchaOnVerify"
        data-expired-callback="hcaptchaOnExpire"
        data-theme={theme}
      />
      <input type="hidden" name={inputName} value={token} />
    </div>
  );
}
