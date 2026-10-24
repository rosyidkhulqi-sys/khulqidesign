import PageHeader from "./PageHeader";
import "./Icons.css";

function Downloads({ setPage }) {
  return (
    <section className="icons-page">
      <PageHeader
        page="downloads"
        setPage={setPage}
        title="Your Downloads"
        subtitle="Files you have downloaded"
      />
      <p style={{ color: "#9a9a9a" }}>No downloads yet.</p>
    </section>
  );
}

export default Downloads;