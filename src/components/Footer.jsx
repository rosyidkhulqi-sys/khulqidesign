import "./Footer.css";
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
];

const services = ["Brand identity", "UI design", "Motion design", "Client projects"];

function Footer({ language, setLanguage, setPage }) {
  const go = (page) => (e) => {
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
            <a key={page} href="#" onClick={go(page)}>{label}</a>
          ))}
        </div>

        <div>
          <h3>Services</h3>
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
        <span>Digital asset studio</span>
      </div>
    </footer>
  );
}

export default Footer;
