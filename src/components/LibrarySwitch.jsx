// The library picker on the left of a library's search box: choosing
// another library takes the words typed there along (as Adobe Stock's and
// Envato's pickers do), so a search moves between ecosystems in one step.
import { libraries } from "../data/libraries";

function LibrarySwitch({ current, search = "", setPage, children = null, value, onLocal }) {
  const go = (e) => {
    const page = e.target.value;
    if (libraries.some((l) => l.page === page) && page !== current) {
      setPage(page, search.trim());
      window.scrollTo(0, 0);
    } else onLocal?.(e);
  };
  return (
    <select className="search-type" value={value ?? current} onChange={go} aria-label="Search in">
      {/* a library's own choices first (Icons: single icons or sets) */}
      {children ?? <option value={current}>{libraries.find((l) => l.page === current)?.title}</option>}
      <optgroup label="Other libraries">
        {libraries.filter((l) => l.page !== current).map((l) => <option key={l.page} value={l.page}>{l.title}</option>)}
      </optgroup>
    </select>
  );
}

export default LibrarySwitch;
