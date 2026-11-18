"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const LANGS = [
  { code: "en", name: "English", short: "EN" },
  { code: "ur", name: "اردو", short: "اردو" },
];

// Keeps the reader on the same page (e.g. the same article) when switching language.
function swapLang(pathname, code) {
  const parts = (pathname || "/").split("/");
  if (LANGS.some((l) => l.code === parts[1])) parts[1] = code;
  else return `/${code}`;
  return parts.join("/") || `/${code}`;
}

export default function LangSwitcher({ current, label }) {
  const pathname = usePathname();
  const menu = useRef(null);
  const active = LANGS.find((l) => l.code === current) || LANGS[0];

  // Close the mobile menu after navigation or a click outside
  useEffect(() => {
    const close = (e) => { if (menu.current && !menu.current.contains(e.target)) menu.current.open = false; };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="lang">
      <nav className="lang-pills" aria-label={label}>
        {LANGS.map((l) => (
          <a key={l.code} href={swapLang(pathname, l.code)} lang={l.code} hrefLang={l.code}
            className={`lang-${l.code}`} aria-current={l.code === current ? "true" : undefined}>
            {l.name}
          </a>
        ))}
      </nav>
      <details className="lang-menu" ref={menu}>
        <summary aria-label={label}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <span lang={active.code} className={`lang-${active.code}`}>{active.short}</span>
        </summary>
        <ul>
          {LANGS.map((l) => (
            <li key={l.code}>
              <a href={swapLang(pathname, l.code)} lang={l.code} hrefLang={l.code}
                className={`lang-${l.code}`} aria-current={l.code === current ? "true" : undefined}>
                {l.name}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
