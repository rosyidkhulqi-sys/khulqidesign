import Footer from "./components/Footer";
import PageHeader from "./components/PageHeader";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { forgetReturn, pathFor, readLocation, rememberReturn, titleFor, updateHeadFor } from "./lib/router";
import { ASK_LOGIN } from "./lib/authGate";
import LoginDialog from "./components/LoginDialog";
import "./styles/App.css";

import Home from "./pages/home/Home";
import Icons from "./pages/icons/Icons";
import Vectors from "./pages/vectors/Vectors";
// the editor pulls in the canvas library, so load it only when opened
const Create = lazy(() => import("./pages/create/Create"));
// the AI page is loaded when opened too, to keep the first download small
const Ai = lazy(() => import("./pages/ai/Ai"));
// Logos carries its own search keywords, so it loads when opened as well
const Logos = lazy(() => import("./pages/logos/Logos"));
const Pricing = lazy(() => import("./pages/pricing/Pricing"));
const License = lazy(() => import("./pages/license/License"));
const About = lazy(() => import("./pages/about/About"));
const Legal = lazy(() => import("./pages/legal/Legal"));
const Account = lazy(() => import("./pages/account/Account"));
// pages visited now and then load on demand too
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Downloads = lazy(() => import("./pages/downloads/Downloads"));
const NotFound = lazy(() => import("./pages/notfound/NotFound"));
// the owner's upload desk; reads file metadata with exifr, so it loads apart
const Admin = lazy(() => import("./pages/admin/Admin"));
const Templates = lazy(() => import("./pages/templates/Templates"));
const Footage = lazy(() => import("./pages/footage/Footage"));


// pages on the way to an account keep the page to come back to after
// logging in; going anywhere else drops it, so a later "Log in" from the
// header lands on Home
const AUTH_PAGES = ["login", "register", "pricing"];

// the address the visitor arrived on decides the first page
const start = readLocation();

function App() {
  const [page, setPage] = useState(start.page);
  const [language, setLanguage] = useState("EN");
  const [createDraft, setCreateDraft] = useState(null);
  // search typed on the home page, handed to the library page it opens
  const [searchQuery, setSearchQuery] = useState(start.query);
  // the signed-in Supabase user, or null when logged out
  const [user, setUser] = useState(null);
  // why the "log in to continue" dialog is open, or null when it's closed
  const [loginReason, setLoginReason] = useState(null);
  // the icon sent from an icon's detail view to the Animate studio
  const [animateIcon, setAnimateIcon] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // logged in from another tab or after Google: no need to ask any more
      if (session) setLoginReason(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // askLogin() from any page opens the dialog
  useEffect(() => {
    const onAsk = (e) => setLoginReason(e.detail);
    window.addEventListener(ASK_LOGIN, onAsk);
    return () => window.removeEventListener(ASK_LOGIN, onAsk);
  }, []);

  // Back and Forward: show the page the address now points to
  useEffect(() => {
    const onPop = () => {
      const { page: nextPage, query } = readLocation();
      if (!AUTH_PAGES.includes(nextPage)) forgetReturn();
      setSearchQuery(query);
      setAnimateIcon(null);
      setPage(nextPage);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // the browser tab names the page, for people and for search engines
  useEffect(() => {
    document.title = titleFor(page);
    updateHeadFor(page);
  }, [page]);

  const go = (nextPage, query = "") => {
    if (!AUTH_PAGES.includes(nextPage)) forgetReturn();
    setSearchQuery(query);
    setAnimateIcon(null);
    setPage(nextPage);
    // a new history entry only when the address actually changes
    const next = pathFor(nextPage, query);
    if (next !== window.location.pathname + window.location.search) {
      window.history.pushState(null, "", next);
    }
  };

  // leave for Log in / Create account / Pricing, and come back here after
  const authFromDialog = (target) => {
    rememberReturn(page);
    setLoginReason(null);
    go(target);
    window.scrollTo(0, 0);
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
    home: <Home setPage={go} user={user} />,
    ai: (
      <Suspense fallback={null}>
        <Ai setPage={go} user={user} animateIcon={animateIcon} openInCreate={customize} />
      </Suspense>
    ),
    // keyed by the search, so ?q= from a link or Back starts a fresh search
    icons: <Icons key={searchQuery} setPage={go} initialSearch={searchQuery} user={user} onAnimate={animate} />,
    vectors: <Vectors key={searchQuery} setPage={go} initialSearch={searchQuery} user={user} />,
    logos: (
      <Suspense fallback={null}>
        <Logos key={searchQuery} setPage={go} initialSearch={searchQuery} user={user} />
      </Suspense>
    ),
    templates: (
      <Suspense fallback={null}>
        <Templates key={searchQuery} setPage={go} onCustomize={customize} initialSearch={searchQuery} />
      </Suspense>
    ),
    footage: (
      <Suspense fallback={null}>
        <Footage key={searchQuery} setPage={go} initialSearch={searchQuery} user={user} />
      </Suspense>
    ),
    downloads: (
      <Suspense fallback={null}>
        <Downloads setPage={go} user={user} />
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
    refund: (
      <Suspense fallback={null}>
        <Legal key="refund" doc="refund" setPage={go} />
      </Suspense>
    ),
    about: (
      <Suspense fallback={null}>
        <About setPage={go} />
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
        {/* anyone can design; downloading the design asks for an account */}
        <Create draft={createDraft} clearDraft={() => setCreateDraft(null)} user={user} />
      </Suspense>
    ),
    admin: (
      <Suspense fallback={null}>
        <Admin user={user} setPage={go} />
      </Suspense>
    ),
    notfound: (
      <Suspense fallback={null}>
        <NotFound setPage={go} />
      </Suspense>
    ),
  };

  // every page shares the header; the editor fills the screen, so it has no footer
  return (
    <>
      <PageHeader page={page} setPage={go} user={user} onLogout={logout} />
      {pages[page] ?? pages.notfound}
      {loginReason && !user && (
        <LoginDialog reason={loginReason} onAuth={authFromDialog} onClose={() => setLoginReason(null)} />
      )}
      {page !== "create" && (
        <Footer language={language} setLanguage={setLanguage} setPage={go} />
      )}
    </>
  );
}

export default App;
