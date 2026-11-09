// A simple footer: the brand and language on the left, then three short
// columns. Every link appears once; the bottom line is only the copyright.
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
  ["pricing", "Pricing"],
  ["license", "License"],
  ["terms", "Terms of Service"],
  ["privacy", "Privacy Policy"],
];

// social profiles join this list once they have real addresses
const contact = [
  ["mailto:khulqidesign@mail.com", "Email"],
  ["https://wa.me/6285236752860", "WhatsApp"],
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

  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand">
          <a href="/" onClick={go("home")} className="footer-logo" aria-label="Khulqidesign home">
            <img src="/logo.png" alt="" />
            <img src="/KD Logogram.png" alt="Khulqidesign" />
          </a>
          <p>
            Icons, vectors, logos, templates and footage, with Create and free AI tools
            to make them yours.
          </p>
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
        </div>

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

          {/* shown once the studio takes projects (data/services.js) */}
          {SERVICES_OPEN && (
            <div>
              <h3>Services</h3>
              {services.map(([, title]) => (
                <a key={title} href="#services" onClick={toServices}>{title}</a>
              ))}
            </div>
          )}

          <div>
            <h3>Get in touch</h3>
            {contact.map(([href, label]) => (
              <a key={label} href={href}>{label}</a>
            ))}
          </div>
        </nav>
      </div>

      <p className="footer-bottom">© {new Date().getFullYear()} Khulqidesign. All rights reserved.</p>
    </footer>
  );
}

export default Footer;
