import LanguageSwitcher from "./LanguageSwitcher";
import Footer from "./Footer";
import { useState } from "react";
import "./App.css";

import Icons from "./Icons";
import Vectors from "./Vectors";
import Templates from "./Templates";
import Video from "./Video";
import Login from "./Login";
import Register from "./Register";


function App() {
  const [page, setPage] = useState("home");
  const [language, setLanguage] = useState("EN");

if (page === "icons") {
  return (
    <>
      <Icons setPage={setPage} />
      <Footer
        language={language}
        setLanguage={setLanguage}
      />
    </>
  );
}

if (page === "login") {
  return <Login setPage={setPage} />;
}

if (page === "register") {
  return <Register setPage={setPage} />;
}

  return (
    <div className="container">

      <nav className="navbar">
        
  <div className="logo">
  <img src="/logo.png" alt="Logo" className="logo-img" />

  <img
    src="/KD Logogram.png"
    alt="Khulqi Design"
    className="wordmark-img"
  />

</div>
        <div className="menu">
          <a href="#icons">Icons
  
          </a>
          <a href="#vectors">Vectors

          </a>
          <a href="#templates">Templates

          </a>
          <a href="#video">Video

          </a>
        </div>
        <div className="auth-buttons">
           <a href="#" onClick={() => setPage("login")}>Login</a>
           <a href="#" className="register-btn" onClick={() => setPage("register")}>Register</a>
         </div> 
      </nav>

      <section id="home" className="hero">
        <video
         autoPlay
         muted
         loop
         playsInline
         className="hero-video"
         onLoadedMetadata={(e) => {
          e.target.playbackRate = 0.5;
         }}
          >
         <source src="/video background.mp4" 
         type="video/mp4" />
        </video>

  <div className="hero-text"></div>

       <div className="hero-text">
        <h1>Digital Asset Studio</h1>

        <div className="hero-search">
          <input
            type="text"
            placeholder="Search icons, vectors, templates..."
          />
          <button>Search</button>
  </div>

      <div className="hero-categories">
        <span>Icons</span>
        <span>Vectors</span>
        <span>Templates</span>
        <span>Video</span>
      </div>

          <p>
            Build Beyond Microstock with premium digital assets,
            branding, templates, icons, and creative solutions.
          </p>

          <div className="btn-group">
            <a href="#portfolio" className="btn btn-red">
              Explore Assets
            </a>
            <a href="#services" className="btn btn-dark">
              Our Services
            </a>
         
        </div>


</div>

</section>
<section id="services" className="services">
  <div className="section-head">
    <p>SERVICES</p>
    <h2>Creative Solutions</h2>
  </div>

 <div className="service-grid">
  <button className="service-card">Brand Identity</button>
  <button className="service-card">UI Design</button>
  <button className="service-card">Motion Design</button>
  <button className="service-card">Client Projects</button>
</div>
</section>

{/* PORTFOLIO */}
<section id="portfolio" className="portfolio">
  <div className="portfolio-head">
    <p>PORTFOLIO</p>
    <h2>Digital Assets</h2>
  </div>

  <div className="portfolio-filter">
    <button>All</button>
    <button onClick={() => setPage("icons")}>
      Icons
    </button>
    <button>Vectors</button>
    <button>Templates</button>
    <button>Video</button>
  </div>

  {/* GRID */}

 <div className="portfolio-grid">
  <div
    className="portfolio-card"
    onClick={() => setPage("icons")}
  >
    <img src="/preview1.jpg" alt="Icons" />
    <h3>Icons</h3>
  </div>

  <div className="portfolio-card">
    <img src="/preview2.jpg" alt="Vectors" />
    <h3>Vectors</h3>
  </div>

  <div className="portfolio-card">
    <img src="/preview3.jpg" alt="Templates" />
    <h3>Templates</h3>
  </div>

  <div className="portfolio-card">
    <img src="/preview4.jpg" alt="Video" />
    <h3>Video</h3>
  </div>

 </div>
</section>

{/* PRODUCTS */}
<section className="product-section">
  <div className="product-head">
    <p>PRODUCTS</p>
    <h2>Digital Assets</h2>
  </div>

  <div className="product-grid">
    <div className="product-card">
      <span>01</span>
      <h3>Illustrations</h3>
      <p>Premium vector packs & creative artwork</p>
    </div>

    <div className="product-card">
      <span>02</span>
      <h3>Icons</h3>
      <p>Minimal icon systems & UI assets</p>
    </div>

    <div className="product-card">
      <span>03</span>
      <h3>Templates</h3>
      <p>Social media, business & web templates</p>
    </div>

    <div className="product-card">
      <span>04</span>
      <h3>Graphic Elements</h3>
      <p>Patterns, badges, shapes & creative assets</p>
    </div>
  </div>
</section>

{/* CONTACT */}
<section id="contact" className="contact">
  <div className="contact-content">
    <p>CONTACT</p>
    <h2>Let’s Work Together</h2>
    <span>Need icons, vectors, logo or branding assets?</span>

    <div className="contact-buttons">
      <a href="mailto:khulqidesign@mail.com">Email Me</a>
      <a href="https://wa.me/6285236752860">WhatsApp</a>
    </div>
  </div>
</section>

<Footer
  language={language}
  setLanguage={setLanguage}
  ></Footer>
</div>
);
}

export default App;
