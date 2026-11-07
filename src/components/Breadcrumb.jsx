import "./Breadcrumb.css";

// "Home / Current page" trail shown above a page title; parent ({ label, onClick })
// adds a middle step, as in "Home / Icons / Shopping & Promo".
function Breadcrumb({ setPage, current, parent }) {
  const goHome = (e) => {
    e.preventDefault();
    setPage("home");
    window.scrollTo(0, 0);
  };

  const goParent = (e) => {
    e.preventDefault();
    parent.onClick();
    window.scrollTo(0, 0);
  };

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="#" onClick={goHome}>Home</a></li>
        {parent && <li><a href="#" onClick={goParent}>{parent.label}</a></li>}
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}

export default Breadcrumb;
