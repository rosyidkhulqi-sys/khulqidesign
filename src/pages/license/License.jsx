// License: what each license lets people do, in plain words. It matches what
// the site already says in Pricing, AssetModal and LogoModal: Free needs a
// credit line; Premium carries the Standard license (commercial use, no
// credit, up to 500,000 copies, non-exclusive); Extended is a coming add-on;
// Exclusive logos go to one buyer. A summary, not the full legal terms,
// which come with the Terms page and should be checked by a lawyer.
import "../vectors/Vectors.css";
import "./License.css";
import Breadcrumb from "../../components/Breadcrumb";

const UPDATED = "November 2026";

// one column per license; rows answer the questions buyers ask most
const columns = ["Free", "Standard", "Extended", "Exclusive logo"];
const rows = [
  ["How you get it", "Free download", "Premium subscription", "Add-on, coming soon", "One-time purchase"],
  ["Personal and commercial use", "Yes", "Yes", "Yes", "Yes"],
  ["Credit line", "Required", "Not needed", "Not needed", "Not needed"],
  ["Client work", "Yes", "Yes", "Yes", "Yes"],
  ["Print copies", "Up to 500,000", "Up to 500,000", "Unlimited", "Unlimited"],
  ["Merchandise for sale", "No", "No", "Yes", "Yes"],
  ["Others may use the same file", "Yes", "Yes", "Yes", "No, one buyer only"],
  ["Register as a trademark", "No", "No", "No", "Yes"],
];

const yes = [
  "Websites, apps, social media, ads and video",
  "Printed matter: flyers, posters, packaging, books",
  "Work for your clients, delivered as part of a finished design",
  "Editing: change colors, crop, combine with your own work",
  "Free and Premium logos as your brand's logo (without trademark registration)",
];

const no = [
  "Reselling, sharing or giving away the files as they are, alone or in a pack",
  "Uploading them to other stock sites, template shops or print-on-demand stores as your own",
  "Templates or design kits for sale where our asset is the main part",
  "Registering a Free or Premium asset or logo as a trademark",
  "Training AI models, or building datasets, with the files",
  "Anything illegal, hateful or misleading",
];

const notes = [
  [
    "Free assets",
    "Add “Designed by Khulqidesign” (for logos, “Logo by Khulqidesign”) near the work, in the credits or on the page where it appears.",
  ],
  [
    "Premium and the Standard license",
    "Every file you download while subscribed comes with the Standard license, with no credit line. If you cancel, the files you already used stay licensed for those projects; new projects need an active plan.",
  ],
  [
    "Extended license",
    "For merchandise, products for resale and print runs above 500,000 copies. It will be offered as an add-on per file.",
  ],
  [
    "Exclusive logos",
    "Bought once by one buyer. The logo is taken off sale, the full files and rights pass to you, and you may register it as a trademark. We may still show it in our portfolio, marked Sold.",
  ],
  [
    "Footage",
    "Our clips are abstract and motion backgrounds with no people or private property, so no releases are needed. They have no audio.",
  ],
];

function License({ setPage }) {
  return (
    <section className="vectors-page license-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="License" />
        <h1>
          License <span className="library-count">What you can do with our files</span>
        </h1>
      </div>

      <p className="lc-intro">
        A plain-language summary of how you may use Khulqidesign assets. It applies to every
        download and purchase. Updated {UPDATED}.
      </p>

      {/* COMPARISON */}
      <div className="lc-table-wrap">
        <table className="lc-table">
          <thead>
            <tr>
              <th />
              {columns.map((c) => <th key={c} scope="col">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...cells]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {cells.map((cell, i) => (
                  <td key={columns[i]} className={cell === "No" ? "is-no" : cell === "Yes" ? "is-yes" : ""}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* YES / NO */}
      <div className="lc-lists">
        <div>
          <h2>You can</h2>
          <ul className="lc-yes">
            {yes.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
        <div>
          <h2>You can't</h2>
          <ul className="lc-no">
            {no.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </div>

      {/* PER LICENSE */}
      <div className="lc-notes">
        {notes.map(([title, text]) => (
          <div key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="lc-foot">
        <p>
          Every download is recorded to your account as proof of license. Not sure if your use is
          covered? Email <a href="mailto:khulqidesign@mail.com">khulqidesign@mail.com</a>.
        </p>
        <button onClick={() => { setPage("pricing"); window.scrollTo(0, 0); }}>See plans →</button>
      </div>
    </section>
  );
}

export default License;
