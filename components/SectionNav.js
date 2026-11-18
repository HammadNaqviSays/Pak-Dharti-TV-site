"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const HomeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24">
    <path d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5.2v-5.6H9.2V21H4a1 1 0 0 1-1-1z" fill="currentColor" />
  </svg>
);
const Caret = () => (
  <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
);

// Main navigation bar: home, the main sections, a "More" menu for the rest, and the language switcher.
export default function SectionNav({ lang, home, items, more, moreLabel, label, children }) {
  const pathname = usePathname() || "";
  const current = pathname.startsWith(`/${lang}/category/`) ? pathname.split("/")[3] : pathname === `/${lang}` ? "" : null;
  const menu = useRef(null);
  useEffect(() => {
    const close = (e) => { if (menu.current && !menu.current.contains(e.target)) menu.current.open = false; };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const moreActive = more.some((m) => m.key === current);

  return (
    <nav className="navbar" aria-label={label}>
      <div className="wrap navbar-inner">
        <a className="nav-home" href={`/${lang}`} aria-label={home} aria-current={current === "" ? "page" : undefined}><HomeIcon /></a>
        <ul className="nav-list">
          {items.map((it) => (
            <li key={it.key}><a href={it.href} aria-current={current === it.key ? "page" : undefined}>{it.label}</a></li>
          ))}
          {/* On phones the bar scrolls sideways, so the extra sections are listed inline instead of in a menu */}
          {more.map((it) => (
            <li key={`m-${it.key}`} className="nav-extra"><a href={it.href} aria-current={current === it.key ? "page" : undefined}>{it.label}</a></li>
          ))}
          {more.length > 0 && (
            <li className="nav-more">
              <details ref={menu}>
                <summary className={moreActive ? "is-active" : undefined}>{moreLabel} <Caret /></summary>
                <ul className="mega">
                  {more.map((it) => (
                    <li key={it.key}><a href={it.href} aria-current={current === it.key ? "page" : undefined}>{it.label}</a></li>
                  ))}
                </ul>
              </details>
            </li>
          )}
        </ul>
        <div className="nav-end">{children}</div>
      </div>
    </nav>
  );
}
