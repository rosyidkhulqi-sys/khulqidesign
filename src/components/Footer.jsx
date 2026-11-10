// A simple footer: link columns, then the copyright. Every link appears
// once; the sticky header already carries the logo, so the footer doesn't.
import "./Footer.css";
import { pathFor } from "../lib/router";
import { SERVICES_OPEN, services } from "../data/services";
import LanguageSwitcher from "./LanguageSwitcher";

const products = [
  ["ai", "AI tools"],
  ["icons", "Icons"],
  ["vectors", "Vectors"],
  ["logos", "Logos"],
  ["templates", "Templates"],
  ["footage", "Footage"],
  ["create", "Create"],
];

const company = [
  ["about", "About us"],
  ["pricing", "Pricing"],
  ["license", "License"],
  ["refund", "Refund Policy"],
  ["terms", "Terms of Service"],
  ["privacy", "Privacy Policy"],
];

const contact = [
  ["mailto:khulqidesign@mail.com", "Email"],
  ["https://wa.me/6285236752860", "WhatsApp"],
  ["https://www.instagram.com/khulqidesign/", "Instagram"],
  ["https://www.pinterest.com/khulqidesign/", "Pinterest"],
];

function Footer({ language, setLanguage, setPage }) {
  const go = (page) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setPage(page);
    window.scrollTo(0, 0);
  };

  // services live on the home page, so go there first and then scroll
  const toServices = (e) => {
    e.preventDefault();
    setPage("home");
    setTimeout(() => document.getElementById("services")?.scrollIntoView(), 50);
  };

  const backToTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="footer">
      <nav className="footer-columns" aria-label="Footer">
        <div>
          <h3>Products</h3>
          {products.map(([page, label]) => (
            <a key={page} href={pathFor(page)} onClick={go(page)}>{label}</a>
          ))}
        </div>

        <div>
          <h3>Company</h3>
          {company.map(([page, label]) => (
            <a key={page} href={pathFor(page)} onClick={go(page)}>{label}</a>
          ))}
        </div>

        <div>
          {/* until the studio opens (data/services.js) the list says so */}
          <h3>Services {!SERVICES_OPEN && <span className="footer-soon">Soon</span>}</h3>
          {/* plain text while closed: there is nothing to open yet */}
          {services.map(([, title]) =>
            SERVICES_OPEN
              ? <a key={title} href="#services" onClick={toServices}>{title}</a>
              : <span key={title}>{title}</span>
          )}
        </div>

        <div>
          <h3>Get in touch</h3>
          {contact.map(([href, label]) => (
            <a key={label} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {label}
            </a>
          ))}
        </div>

        <div className="footer-back">
          <h3>Navigation</h3>
          <a href="#top" onClick={backToTop}>Back to top <span>↑</span></a>
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
        </div>
      </nav>

      <p className="footer-bottom">© {new Date().getFullYear()} Khulqidesign. All rights reserved.</p>
    </footer>
  );
}

export default Footer;
