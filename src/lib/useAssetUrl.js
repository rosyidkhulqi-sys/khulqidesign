// Keeps an open asset and the address in step, as on Unsplash or Freepik:
// opening one gives it its own address (a new history entry; picking another
// from inside the dialog replaces it), closing it goes back to the list, and
// Back, Forward or a shared link open the right one.
//   load(code) -> Promise<asset | null>, for an address opened directly
import { useEffect, useEffectEvent, useRef } from "react";
import { assetCodeOf, assetHead, assetPath } from "./router";

export function useAssetUrl(page, selected, setSelected, load) {
  // an asset named by the address is being fetched: leave the address alone
  const loading = useRef(false);

  // the address names an asset: open it (or close when it no longer does)
  const followAddress = useEffectEvent(() => {
    const code = assetCodeOf();
    if (!code) {
      if (selected) setSelected(null);
      return;
    }
    if (selected?.code === code) return;
    loading.current = true;
    // not found or offline: the library shows, under its own address
    const fail = () => {
      loading.current = false;
      if (assetCodeOf() === code) window.history.replaceState(null, "", `/${page}`);
    };
    load(code)
      .then((asset) => {
        if (!asset) return fail();
        loading.current = false;
        setSelected(asset);
      })
      .catch(fail);
  });

  useEffect(() => {
    followAddress();
    window.addEventListener("popstate", followAddress);
    return () => window.removeEventListener("popstate", followAddress);
  }, []);

  // the address, tab title and canonical link follow the open asset
  useEffect(() => {
    const code = assetCodeOf();
    const { history } = window;
    if (selected) {
      const next = assetPath(page, selected);
      if (code !== selected.code) {
        // from one asset to another: one entry, so closing goes straight back
        if (code) history.replaceState({ kdAsset: true }, "", next);
        else history.pushState({ kdAsset: true }, "", next);
      } else if (window.location.pathname !== next) {
        // an old or shortened link: show the asset's own words
        history.replaceState(history.state, "", next);
      }
    } else if (code && !loading.current) {
      // opened here: step back to the list; arrived on the link: replace it
      if (history.state?.kdAsset) history.back();
      else history.replaceState(null, "", `/${page}`);
    }
    assetHead(page, selected);
  }, [page, selected]);
}
