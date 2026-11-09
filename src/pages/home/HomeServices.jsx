// The full Services section, shown on Home once SERVICES_OPEN is true
// (data/services.js). Each service opens a WhatsApp chat about it.
import { services } from "../../data/services";
import "./HomeServices.css";

const WHATSAPP = "https://wa.me/6285236752860";

function HomeServices() {
  return (
    <section className="home-services" id="services">
      <div className="home-section-title is-dark">
        <div>
          <p className="home-label">Services</p>
          <h2>Creative<br /><em>solutions.</em></h2>
        </div>
        <p>Custom design work,<br />made for your brand.</p>
      </div>

      <div className="home-service-list">
        {services.map(([number, title, copy]) => (
          <a className="home-service" key={number}
             href={`${WHATSAPP}?text=${encodeURIComponent(`Hi Khulqidesign, I'd like to ask about ${title.toLowerCase()}.`)}`}>
            <span>{number}</span>
            <div><h3>{title}</h3><p>{copy}</p></div>
            <em aria-hidden="true">→</em>
          </a>
        ))}
      </div>
    </section>
  );
}

export default HomeServices;
