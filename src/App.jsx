import Footer from "./components/Footer";
import PageHeader from "./components/PageHeader";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./styles/App.css";

import Home from "./pages/home/Home";
import Icons from "./pages/icons/Icons";
import Vectors from "./pages/vectors/Vectors";
import Templates from "./pages/templates/Templates";
import Footage from "./pages/footage/Footage";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Downloads from "./pages/downloads/Downloads";
// the editor pulls in the canvas library, so load it only when opened
const Create = lazy(() => import("./pages/create/Create"));


function App() {
  const [page, setPage] = useState("home");
  const [language, setLanguage] = useState("EN");
  const [createDraft, setCreateDraft] = useState(null);
  // search typed on the home page, handed to the library page it opens
  const [searchQuery, setSearchQuery] = useState("");
  // the signed-in Supabase user, or null when logged out
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const go = (nextPage, query = "") => {
    setSearchQuery(query);
    setPage(nextPage);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    go("home");
    window.scrollTo(0, 0);
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
    downloads: <Downloads setPage={go} />,
    create: (
      <Suspense fallback={null}>
        <Create draft={createDraft} clearDraft={() => setCreateDraft(null)} />
      </Suspense>
    ),
  };

  // every page shares the header; the editor fills the screen, so it has no footer
  return (
    <>
      <PageHeader page={page} setPage={go} user={user} onLogout={logout} />
      {pages[page] ?? pages.home}
      {page !== "create" && (
        <Footer language={language} setLanguage={setLanguage} setPage={go} />
      )}
    </>
  );
}

export default App;
