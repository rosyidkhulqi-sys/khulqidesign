import "./Breadcrumb.css";

// "Home / Current page" trail shown above a page title.
function Breadcrumb({ setPage, current }) {
  const goHome = (e) => {
    e.preventDefault();
    setPage("home");
    window.scrollTo(0, 0);
  };

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="#" onClick={goHome}>Home</a></li>
        <li aria-current="page">{current}</li>
      </ol>
    </nav>
  );
}

export default Breadcrumb;
