import "./Footer.css";
import { pathFor } from "../lib/router";
import LanguageSwitcher from "./LanguageSwitcher";

const products = [
  ["ai", "AI"],
  ["icons", "Icons"],
  ["vectors", "Vectors"],
  ["logos", "Logos"],
  ["templates", "Templates"],
  ["footage", "Footage"],
  ["create", "Create"],
  ["pricing", "Pricing"],
  ["license", "License"],
];

const services = ["Brand identity", "UI design", "Motion design", "Client projects"];

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
      <div className="footer-columns">
        <div>
          <h3>Products</h3>
          {products.map(([page, label]) => (
            <a key={page} href={pathFor(page)} onClick={go(page)}>{label}</a>
          ))}
        </div>

        <div>
          {/* the studio opens later; the list says so */}
          <h3>Services <span className="footer-soon">Soon</span></h3>
          {services.map((s) => (
            <a key={s} href="#services" onClick={toServices}>{s}</a>
          ))}
        </div>

        <div>
          <h3>Social</h3>
          <a href="#">Instagram</a>
          <a href="#">Facebook</a>
          <a href="#">X / Twitter</a>
          <a href="https://wa.me/6285236752860">WhatsApp</a>
        </div>

        <div className="footer-back">
          <h3>Navigation</h3>
          <a href="#top" onClick={backToTop}>Back to top <span>↑</span></a>
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Khulqi Design</span>
        <span className="footer-legal">
          <a href={pathFor("terms")} onClick={go("terms")}>Terms</a>
          <a href={pathFor("privacy")} onClick={go("privacy")}>Privacy</a>
          <a href={pathFor("license")} onClick={go("license")}>License</a>
        </span>
      </div>
    </footer>
  );
}

export default Footer;
