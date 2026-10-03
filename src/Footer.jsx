import "./Footer.css";
import LanguageSwitcher from "./LanguageSwitcher";

function Footer({ language, setLanguage }) {
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
          <a href="#">Illustrations</a>
          <a href="#">Icons</a>
          <a href="#">Templates</a>
          <a href="#">Graphic Elements</a>
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

    </footer>
  );
}

export default Footer;