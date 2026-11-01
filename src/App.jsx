import Footer from "./Footer";
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

  const footer = <Footer language={language} setLanguage={setLanguage} setPage={go} />;

  if (page === "templates") {
    return (
      <>
        <Templates setPage={go} onCustomize={customize} initialSearch={searchQuery} />
        {footer}
      </>
    );
  }

  if (page === "create") {
    return (
      <Suspense fallback={null}>
        <Create
          setPage={go}
          draft={createDraft}
          clearDraft={() => setCreateDraft(null)}
        />
      </Suspense>
    );
  }

  if (page === "icons") {
    return (
      <>
        <Icons setPage={go} initialSearch={searchQuery} />
        {footer}
      </>
    );
  }

  if (page === "downloads") {
    return (
      <>
        <Downloads setPage={go} />
        {footer}
      </>
    );
  }

  if (page === "vectors") {
    return (
      <>
        <Vectors setPage={go} initialSearch={searchQuery} />
        {footer}
      </>
    );
  }

  if (page === "footage") {
    return (
      <>
        <Footage setPage={go} initialSearch={searchQuery} />
        {footer}
      </>
    );
  }

  if (page === "login") {
    return <Login setPage={go} />;
  }

  if (page === "register") {
    return <Register setPage={go} />;
  }

  return (
    <>
      <Home setPage={go} />
      {footer}
    </>
  );
}

export default App;
