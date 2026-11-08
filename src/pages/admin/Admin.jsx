// /admin: the owner's upload desk. Step 1 handles vectors: drop EPS + JPG
// pairs, check the details read from each JPG, publish. Icons, logos and
// footage follow the same pattern next. Only admins get past the guard; the
// database and the r2-sign function check the role again on every write.
import { useEffect, useRef, useState } from "react";
import "../vectors/Vectors.css";
import "./Admin.css";
import Breadcrumb from "../../components/Breadcrumb";
import { supabase } from "../../lib/supabaseClient";
import ManageAssets from "./ManageAssets";
import IconUpload from "./IconUpload.jsx";

const TABS = [
  ["vector", "Vectors", "EPS + JPG pairs"],
  ["icon", "Icons", "SVG icons in sets"],
];
import {
  VECTOR_CATEGORIES,
  pairFiles,
  publishVector,
  readMetadata,
  shortTitle,
} from "./vectorUpload";

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Admin({ user, setPage }) {
  // "checking" | "admin" | "denied"
  const [access, setAccess] = useState("checking");
  const [items, setItems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [dragging, setDragging] = useState(false);
  // bumped after publishing so the uploaded list reloads
  const [published, setPublished] = useState(0);
  // which kind of asset this desk uploads
  const [tab, setTab] = useState("vector");
  const input = useRef(null);
  // preview URLs made for the table, released when items go away
  const urls = useRef([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.rpc("is_admin").then(({ data }) => alive && setAccess(data === true ? "admin" : "denied"));
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const update = (base, patch) =>
    setItems((list) => list.map((it) => (it.base === base ? { ...it, ...patch } : it)));

  const addFiles = async (fileList) => {
    const pairs = pairFiles(fileList).filter((p) => !items.some((it) => it.base === p.base));
    const fresh = pairs.map((p) => {
      const thumb = p.jpg ? URL.createObjectURL(p.jpg) : null;
      if (thumb) urls.current.push(thumb);
      return {
        ...p,
        thumb,
        title: "",
        longTitle: "",
        description: "",
        keywords: [],
        category: "other",
        license: "premium",
        status: p.eps && p.jpg ? "reading" : "incomplete",
        progress: 0,
        message: p.eps && p.jpg ? "Reading metadata" : `Missing ${p.eps ? "JPG" : "EPS"}`,
      };
    });
    setItems((list) => [...list, ...fresh]);

    for (const item of fresh.filter((it) => it.status === "reading")) {
      try {
        const meta = await readMetadata(item.jpg);
        update(item.base, {
          ...meta,
          title: shortTitle(meta.longTitle) || shortTitle(item.base),
          status: "ready",
          message: meta.keywords.length ? `${meta.keywords.length} keywords` : "No keywords in this JPG",
        });
      } catch {
        update(item.base, { title: shortTitle(item.base), status: "ready", message: "Couldn't read metadata" });
      }
    }
  };

  const publishAll = async () => {
    setPublishing(true);
    for (const item of items.filter((it) => it.status === "ready" || it.status === "error")) {
      if (!item.title.trim()) {
        update(item.base, { status: "error", message: "Add a title first" });
        continue;
      }
      update(item.base, { status: "uploading", progress: 0, message: "Preparing" });
      try {
        const code = await publishVector({ ...item, title: item.title.trim() }, (message, progress) =>
          update(item.base, { message, progress })
        );
        update(item.base, { status: "done", progress: 1, message: `Published as ${code}` });
      } catch (e) {
        update(item.base, { status: "error", message: e.message });
      }
    }
    setPublishing(false);
    setPublished((n) => n + 1);
  };

  const clearDone = () => setItems((list) => list.filter((it) => it.status !== "done"));

  if (!user || access !== "admin") {
    return (
      <section className="vectors-page admin-page">
        <div className="library-head">
          <Breadcrumb setPage={setPage} current="Admin" />
          <h1>Admin</h1>
        </div>
        <p className="ad-note">
          {!user
            ? "Log in with an admin account to upload assets."
            : access === "checking"
              ? "Checking your access…"
              : "This area is for Khulqidesign admins only."}
        </p>
        {!user && (
          <button className="ad-primary" onClick={() => setPage("login")}>Log in</button>
        )}
      </section>
    );
  }

  const ready = items.filter((it) => it.status === "ready" || it.status === "error").length;
  const done = items.filter((it) => it.status === "done").length;

  return (
    <section className="vectors-page admin-page">
      <div className="library-head">
        <Breadcrumb setPage={setPage} current="Admin" />
        <h1>
          Upload <span className="library-count">{TABS.find(([id]) => id === tab)[2]}</span>
        </h1>
      </div>

      <div className="ad-tabs" role="tablist" aria-label="Asset type">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)} disabled={publishing}>
            {label}
          </button>
        ))}
      </div>

      {tab === "icon" ? (
        <IconUpload onPublished={() => setPublished((n) => n + 1)} />
      ) : (
      <>
      {/* DROP ZONE */}
      <div
        className={`ad-drop ${dragging ? "is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles([...e.dataTransfer.files]);
        }}
      >
        <strong>Drop EPS and JPG files here</strong>
        <span>
          Files with the same name become one vector. Title, description and keywords come from
          the JPG's metadata, as on Adobe Stock and Shutterstock.
        </span>
        <button onClick={() => input.current?.click()}>Choose files</button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".eps,.jpg,.jpeg"
          hidden
          onChange={(e) => {
            addFiles([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="ad-bar">
            <span>
              {items.length} {items.length === 1 ? "vector" : "vectors"}
              {done > 0 && ` · ${done} published`}
            </span>
            {done > 0 && <button onClick={clearDone} disabled={publishing}>Clear published</button>}
            <button className="ad-primary" onClick={publishAll} disabled={publishing || ready === 0}>
              {publishing ? "Publishing…" : `Publish ${ready}`}
            </button>
          </div>

          <div className="ad-list">
            {items.map((it) => {
              const locked = publishing || it.status === "done" || it.status === "uploading";
              return (
                <div className={`ad-item is-${it.status}`} key={it.base}>
                  <div className="ad-thumb">{it.thumb && <img src={it.thumb} alt="" />}</div>
                  <div className="ad-fields">
                    <input
                      value={it.title}
                      placeholder="Short title"
                      maxLength={80}
                      disabled={locked || it.status === "incomplete"}
                      onChange={(e) => update(it.base, { title: e.target.value })}
                      aria-label="Title"
                    />
                    <div className="ad-row">
                      <select
                        value={it.category}
                        disabled={locked || it.status === "incomplete"}
                        onChange={(e) => update(it.base, { category: e.target.value })}
                        aria-label="Category"
                      >
                        {VECTOR_CATEGORIES.map((c) => <option key={c} value={c}>{capitalize(c)}</option>)}
                      </select>
                      <select
                        value={it.license}
                        disabled={locked || it.status === "incomplete"}
                        onChange={(e) => update(it.base, { license: e.target.value })}
                        aria-label="License"
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                      </select>
                      <span className="ad-file">{it.base}</span>
                    </div>
                    {it.keywords.length > 0 && (
                      <p className="ad-keywords">{it.keywords.slice(0, 12).join(", ")}{it.keywords.length > 12 ? " …" : ""}</p>
                    )}
                  </div>
                  <div className="ad-status">
                    <span>{it.message}</span>
                    {it.status === "uploading" && (
                      <div className="ad-progress"><span style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>
                    )}
                    {!locked && (
                      <button
                        className="ad-remove"
                        onClick={() => setItems((list) => list.filter((x) => x.base !== it.base))}
                        aria-label={`Remove ${it.base}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      </>
      )}

      <ManageAssets type={tab} refreshKey={published} />
    </section>
  );
}

export default Admin;
