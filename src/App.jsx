import Footer from "./Footer";
import PageHeader from "./PageHeader";
import { lazy, Suspense, useState } from "react";
import "./App.css";

import Home from "./Home";
import Icons from "./Icons";
import Vectors from "./Vectors";
import Templates from "./Templates";
import Footage from "./Footage";
import Login from "./Login";
import Register from "./Register";
import Downloads from "./Downloads";
// the editor pulls in the canvas library, so load it only when opened
const Create = lazy(() => import("./Create"));


function App() {
  const [page, setPage] = useState("home");
  const [language, setLanguage] = useState("EN");
  const [createDraft, setCreateDraft] = useState(null);
  // search typed on the home page, handed to the library page it opens
  const [searchQuery, setSearchQuery] = useState("");

  const go = (nextPage, query = "") => {
    setSearchQuery(query);
    setPage(nextPage);
  };

  const customize = (template) => {
    setCreateDraft(template);
    go("create");
    window.scrollTo(0, 0);
  };

  if (page === "login") {
    return <Login setPage={go} />;
  }

  if (page === "register") {
    return <Register setPage={go} />;
  }

  const pages = {
    home: <Home setPage={go} />,
    icons: <Icons initialSearch={searchQuery} />,
    vectors: <Vectors initialSearch={searchQuery} />,
    templates: <Templates onCustomize={customize} initialSearch={searchQuery} />,
    footage: <Footage initialSearch={searchQuery} />,
    downloads: <Downloads />,
    create: (
      <Suspense fallback={null}>
        <Create draft={createDraft} clearDraft={() => setCreateDraft(null)} />
      </Suspense>
    ),
  };

  // every page shares the header; the editor fills the screen, so it has no footer
  return (
    <>
      <PageHeader page={page} setPage={go} />
      {pages[page] ?? pages.home}
      {page !== "create" && (
        <Footer language={language} setLanguage={setLanguage} setPage={go} />
      )}
    </>
  );
}

export default App;
