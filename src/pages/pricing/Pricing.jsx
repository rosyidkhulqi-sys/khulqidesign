// Pricing: Free and Premium, billed in USD, a Founding member offer for
// launch, and Exclusive logos as a one-time purchase outside any plan.
// Prices live in PLANS below so they change in one place. Checkout comes
// with the backend; until then the paid buttons are marked Coming soon.
//
// Set from competitor research (Nov 2026): Envato Core from $8.99/mo,
// Flaticon €7.50/mo, Kerismaker Pro $8.25/mo, Craftwork $12.42/mo, all
// billed yearly. $6/mo yearly is the lowest of them without looking cheap
// to US and EU buyers. Download limits, browser-side tools and AI credits
// keep the plans from losing money on bulk downloads or AI tokens.
import { useState } from "react";
import "../vectors/Vectors.css";
import "./Pricing.css";
import Breadcrumb from "../../components/Breadcrumb";

const PLANS = {
  monthly: 10,
  // per month, billed once a year
  yearly: 6,
  // per year, locked for as long as the member stays subscribed
  founding: 59,
  foundingSeats: 500,
};

const yearlyTotal = PLANS.yearly * 12;
const saving = Math.round((1 - PLANS.yearly / PLANS.monthly) * 100);

// limits are enforced by the backend; the page states them up front
const freeFeatures = [
  "Free icons, vectors, logos, templates and footage",
  "10 downloads a day",
  "PNG icons up to 512 px",
  "Edit in Create and the icon editor",
  "Animate icons",
  "Remove background, 5 a day",
  "Credit line required",
];

// Premium in two groups: the library (much of it also sold per file on
// other stock sites, so the plan is the cheaper way in) and what is only here
const premiumGroups = [
  ["Library", [
    "Every Premium icon, vector, template and clip",
    "Unlimited downloads (fair use)",
    "SVG, EPS and copy to Figma",
    "No credit line",
    "Commercial license on every download",
  ]],
  ["Only on Khulqidesign", [
    "Premium logos (non-exclusive)",
    "Create elements and templates",
    "Remove background and upscale, unlimited",
    "AI credits each month for image and video tools",
  ]],
];

const faqs = [
  [
    "Can I cancel anytime?",
    "Yes. You can cancel whenever you like, and everything you downloaded while subscribed stays licensed for the projects you used it in.",
  ],
  [
    "What's the difference between a Premium logo and an Exclusive logo?",
    "A Premium logo comes with the subscription and is non-exclusive: other subscribers may use it too, so change the name and colors to make it yours. An Exclusive logo is bought once by one buyer, then taken off sale; the files and rights are yours alone.",
  ],
  [
    "Do I have to credit Free assets?",
    "Yes. Add “Designed by Khulqidesign” wherever you use a Free asset. Premium removes the credit line.",
  ],
  [
    "Can I use assets in client work?",
    "Yes. Premium covers commercial use, including work for clients. Reselling or sharing the files as they are isn't allowed.",
  ],
  [
    "What about merchandise or very large print runs?",
    "The standard license covers web, social and print up to 500,000 copies. An extended license for merchandise and resale is coming as an add-on.",
  ],
  [
    "Can I resell or share the files?",
    "No. Use the assets in your own designs and client work, but don't resell, share or upload the files as they are. Every download is recorded to your account.",
  ],
  [
    "How do AI credits work?",
    "Animate, recolor and remove background don't use credits. Tools that generate new images or video do: Premium includes credits every month, and you can top up anytime.",
  ],
  [
    "What is a Founding member?",
    `The first ${PLANS.foundingSeats} members pay $${PLANS.founding} a year instead of $${PLANS.yearly * 12}, and keep that price for as long as they stay subscribed, while the library grows.`,
  ],
  [
    "When can I subscribe?",
    "Checkout opens soon. Create a free account now and you can start downloading Free assets right away.",
  ],
];

function Check() {
  return (
    <svg className="pr-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Pricing({ setPage, user = null }) {
  const [billing, setBilling] = useState("yearly");

  const go = (page) => () => {
    setPage(page);
    window.scrollTo(0, 0);
  };

  const yearly = billing === "yearly";

  return (
    <section className="vectors-page pricing-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Pricing" />
        <h1>
          Pricing <span className="library-count">Start free, go Premium for everything</span>
        </h1>
      </div>

      {/* MONTHLY / YEARLY */}
      <div className="pr-billing" role="radiogroup" aria-label="Billing">
        <button
          role="radio"
          aria-checked={!yearly}
          className={!yearly ? "active" : ""}
          onClick={() => setBilling("monthly")}
        >
          Monthly
        </button>
        <button
          role="radio"
          aria-checked={yearly}
          className={yearly ? "active" : ""}
          onClick={() => setBilling("yearly")}
        >
          Yearly <span className="pr-save">Save {saving}%</span>
        </button>
      </div>

      {/* PLANS */}
      <div className="pr-plans">
        <article className="pr-plan">
          <h2>Free</h2>
          <p className="pr-for">To try things out and for personal projects.</p>
          <p className="pr-price"><strong>$0</strong><span>forever</span></p>
          {user ? (
            <button className="pr-button" disabled>You're on Free</button>
          ) : (
            <button className="pr-button" onClick={go("register")}>Create free account</button>
          )}
          <ul>
            {freeFeatures.map((f) => <li key={f}><Check />{f}</li>)}
          </ul>
        </article>

        <article className="pr-plan is-premium">
          <span className="pr-tag">Most popular</span>
          <h2>Premium</h2>
          <p className="pr-for">For creators, businesses and client work.</p>
          <p className="pr-price">
            {/* on yearly, the monthly price struck through shows the saving */}
            {yearly && <s className="pr-was">${PLANS.monthly}</s>}
            <strong>${yearly ? PLANS.yearly : PLANS.monthly}</strong>
            <span>/ month</span>
          </p>
          <p className="pr-billed">
            {yearly ? `$${yearlyTotal} billed once a year` : "Billed every month"}
          </p>
          <button className="pr-button is-main" disabled>
            Get Premium <span className="ai-soon">Checkout coming soon</span>
          </button>
          {/* what buyers in the US and Europe look for before paying */}
          <p className="pr-trust">
            <span>Cancel anytime</span>
            <span>Secure checkout</span>
            <span>Prices in USD, taxes may apply</span>
          </p>
          <p className="pr-group">Everything in Free, plus</p>
          {premiumGroups.map(([group, features]) => (
            <div key={group}>
              <p className="pr-group">{group}</p>
              <ul>
                {features.map((f) => <li key={f}><Check />{f}</li>)}
              </ul>
            </div>
          ))}
        </article>
      </div>

      {/* FOUNDING MEMBER — launch offer */}
      <div className="pr-founding">
        <div>
          <p className="pr-kicker is-red">Launch offer · first {PLANS.foundingSeats} members</p>
          <h3>Founding member</h3>
          <p>
            Premium for <strong>${PLANS.founding} a year</strong> instead of ${yearlyTotal}, locked in
            for as long as you stay subscribed. Join early and grow with the library.
          </p>
        </div>
        <button disabled>
          Become a founding member <span className="ai-soon">Coming soon</span>
        </button>
      </div>

      {/* EXCLUSIVE LOGOS — outside the plans */}
      <div className="pr-exclusive">
        <div>
          <p className="pr-kicker">Not part of a plan</p>
          <h3>Exclusive logos</h3>
          <p>
            Buy a ready-made logo once, from $199. It's taken off sale, and the full files and
            rights are yours alone.
          </p>
        </div>
        <button onClick={go("logos")}>Browse exclusive logos →</button>
      </div>

      {/* FAQ */}
      <div className="pr-faq">
        <h2>Questions</h2>
        <p className="pr-license">
          What each license allows, in plain words:{" "}
          <button onClick={go("license")}>Read the license →</button>
        </p>
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default Pricing;
