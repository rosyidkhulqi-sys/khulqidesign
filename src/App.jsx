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
// the editor pulls in the canvas library, so load it only when opened
const Create = lazy(() => import("./pages/create/Create"));
// the AI page is loaded when opened too, to keep the first download small
const Ai = lazy(() => import("./pages/ai/Ai"));
// Logos carries its own search keywords, so it loads when opened as well
const Logos = lazy(() => import("./pages/logos/Logos"));
const Pricing = lazy(() => import("./pages/pricing/Pricing"));
const License = lazy(() => import("./pages/license/License"));
const Legal = lazy(() => import("./pages/legal/Legal"));
const Account = lazy(() => import("./pages/account/Account"));
// pages visited now and then load on demand too
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Downloads = lazy(() => import("./pages/downloads/Downloads"));


function App() {
  const [page, setPage] = useState("home");
  const [language, setLanguage] = useState("EN");
  const [createDraft, setCreateDraft] = useState(null);
  // search typed on the home page, handed to the library page it opens
  const [searchQuery, setSearchQuery] = useState("");
  // the signed-in Supabase user, or null when logged out
  const [user, setUser] = useState(null);
  // the icon sent from an icon's detail view to the Animate studio
  const [animateIcon, setAnimateIcon] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const go = (nextPage, query = "") => {
    setSearchQuery(query);
    setAnimateIcon(null);
    setPage(nextPage);
  };

  const animate = (icon) => {
    go("ai");
    setAnimateIcon(icon);
    window.scrollTo(0, 0);
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
    return (
      <Suspense fallback={null}>
        <Login setPage={go} />
      </Suspense>
    );
  }

  if (page === "register") {
    return (
      <Suspense fallback={null}>
        <Register setPage={go} />
      </Suspense>
    );
  }

  const pages = {
    home: <Home setPage={go} />,
    ai: (
      <Suspense fallback={null}>
        <Ai setPage={go} animateIcon={animateIcon} />
      </Suspense>
    ),
    icons: <Icons setPage={go} initialSearch={searchQuery} user={user} onAnimate={animate} />,
    vectors: <Vectors setPage={go} initialSearch={searchQuery} user={user} />,
    logos: (
      <Suspense fallback={null}>
        <Logos setPage={go} initialSearch={searchQuery} user={user} />
      </Suspense>
    ),
    templates: <Templates setPage={go} onCustomize={customize} initialSearch={searchQuery} />,
    footage: <Footage setPage={go} initialSearch={searchQuery} user={user} />,
    downloads: (
      <Suspense fallback={null}>
        <Downloads setPage={go} />
      </Suspense>
    ),
    account: (
      <Suspense fallback={null}>
        <Account user={user} setPage={go} onLogout={logout} />
      </Suspense>
    ),
    terms: (
      <Suspense fallback={null}>
        <Legal key="terms" doc="terms" setPage={go} />
      </Suspense>
    ),
    privacy: (
      <Suspense fallback={null}>
        <Legal key="privacy" doc="privacy" setPage={go} />
      </Suspense>
    ),
    license: (
      <Suspense fallback={null}>
        <License setPage={go} />
      </Suspense>
    ),
    pricing: (
      <Suspense fallback={null}>
        <Pricing setPage={go} user={user} />
      </Suspense>
    ),
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
