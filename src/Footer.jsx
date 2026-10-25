import "./Footer.css";
import LanguageSwitcher from "./LanguageSwitcher";

function Footer({ language, setLanguage, setPage }) {
  return (
    <footer className="footer">

      <div className="footer-top">
        <LanguageSwitcher
          language={language}
          setLanguage={setLanguage}
        />
      </div>

      <div className="footer-links">

        <div>
          <h4>Products</h4>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage("icons"); window.scrollTo(0, 0); }}>Icons</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage("vectors"); window.scrollTo(0, 0); }}>Vectors</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage("templates"); window.scrollTo(0, 0); }}>Templates</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage("video"); window.scrollTo(0, 0); }}>Footage</a>
          <a href="#" onClick={(e) => { e.preventDefault(); setPage("create"); window.scrollTo(0, 0); }}>Create</a>
        </div>

        <div>
          <h4>Services</h4>
          <a href="#">Brand Identity</a>
          <a href="#">UI Design</a>
          <a href="#">Motion Design</a>
          <a href="#">Client Projects</a>
        </div>

        <div>
          <h4>Social</h4>
          <a href="#">Instagram</a>
          <a href="#">Facebook</a>
          <a href="#">X / Twitter</a>
          <a href="#">WhatsApp</a>
        </div>
      </div>   

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Khulqi Design. All rights reserved.</p>
      </div>

    </footer>
  );
}

export default Footer;