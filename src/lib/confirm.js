// askConfirm({ title, message, confirmLabel, danger, typeToConfirm }) opens the
// site's confirmation box and resolves true (confirmed) or false.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import ConfirmDialog from "../components/ConfirmDialog";

export function askConfirm(options) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onDone = (answer) => {
      root.unmount();
      host.remove();
      resolve(answer);
    };
    root.render(createElement(ConfirmDialog, { ...options, onDone }));
  });
}
