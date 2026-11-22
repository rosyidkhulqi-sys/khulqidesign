// The batch an upload goes into, typed above the drop area: "M 1026", for
// example. Left empty, the upload goes into today's dated batch. Typing the
// name of an existing batch adds to it.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const PREFIX = { vector: "VC", icon: "IC", logo: "LG", footage: "FT", element: "EL", template: "TP", photo: "PH", mockup: "MK" };

function today(type) {
  const d = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
  return `${PREFIX[type] ?? "AS"} ${d}`;
}

// the last batch name typed for each type, so a refresh or a second try after
// a dropped upload goes on in the same batch instead of a new dated one
const lastKey = (type) => `kd-last-batch-${type}`;
const readLast = (type) => {
  try {
    return localStorage.getItem(lastKey(type)) ?? "";
  } catch {
    return "";
  }
};

function BatchField({ type, value, onChange, disabled }) {
  // an empty field takes the last name once, when it first shows
  const [filled, setFilled] = useState(false);
  if (!filled) {
    setFilled(true);
    const last = !value && readLast(type);
    if (last) queueMicrotask(() => onChange(last));
  }

  const change = (name) => {
    onChange(name);
    try {
      if (name.trim()) localStorage.setItem(lastKey(type), name.trim());
      else localStorage.removeItem(lastKey(type));
    } catch {
      /* private window: nothing remembered */
    }
  };

  // recent batches of this type, to add to one again
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase
      .from("upload_batches")
      .select("name")
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => alive && setRecent((data ?? []).map((b) => b.name)));
    return () => {
      alive = false;
    };
  }, [type]);

  return (
    <label className="ad-batch">
      <span>Batch</span>
      <input
        value={value}
        onChange={(e) => change(e.target.value)}
        placeholder={`${today(type)} (or a name, such as M 1026)`}
        maxLength={80}
        disabled={disabled}
        list={`ad-batches-${type}`}
        aria-label="Batch name"
      />
      <datalist id={`ad-batches-${type}`}>
        {recent.map((n) => <option key={n} value={n} />)}
      </datalist>
    </label>
  );
}

export default BatchField;
