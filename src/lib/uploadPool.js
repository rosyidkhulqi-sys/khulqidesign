// Runs uploads a few at a time, and keeps the tab alive while they run.
//
// A tab that holds a Web Lock is not frozen or discarded by Chrome and Edge
// when it goes to the background, so an upload keeps going while the admin
// works in another tab or app. (Safari can still pause a hidden tab after a
// while; the work then picks up where it was when the tab comes back.)
export async function runPool(list, atOnce, work) {
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const item = list[next++];
      await work(item);
    }
  };
  const all = () => Promise.all(Array.from({ length: Math.min(atOnce, list.length) }, worker));
  if (navigator.locks?.request) return navigator.locks.request("kd-uploads", { mode: "shared" }, all);
  return all();
}
