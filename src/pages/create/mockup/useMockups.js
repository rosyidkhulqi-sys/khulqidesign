// The published mockups that have a kit, read once for Elements → Mockups;
// null while loading.
import { useEffect, useState } from "react";
import { searchCatalog, toStock } from "../../../lib/catalog";
import { hasMockupKit } from "../../../data/mockupKits";

export default function useMockups() {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    searchCatalog("mockup", { perPage: 60, sort: "newest" })
      .then(({ rows }) => alive && setList(rows.map(toStock).filter((m) => hasMockupKit(m.code))))
      .catch(() => alive && setList([]));
    return () => { alive = false; };
  }, []);
  return list;
}
