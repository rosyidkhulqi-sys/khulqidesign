// Tutorial 01 — Getting started with Create. Each beat is one or two spoken
// sentences and what happens on screen while they're said.
import { fileURLToPath } from "url";
const MEDIA = fileURLToPath(new URL("../media/", import.meta.url));

// page helpers (run inside the page)
const vis = `(e) => e && e.offsetParent !== null`;
const btn = (label, scope = "document") =>
  `[...${scope}.querySelectorAll("button,[role=tab],a,label")].find(e => (${vis})(e) && (e.getAttribute("aria-label") || e.title || e.textContent).trim().startsWith(${JSON.stringify(label)}))`;
const rail = (name) => `[...document.querySelectorAll(".create-rail button")].find(b => b.textContent.trim() === ${JSON.stringify(name)})`;
const tpl = (name) => `[...document.querySelectorAll(".cp-template")].find(e => (e.title || e.getAttribute("aria-label") || e.querySelector("img")?.alt) === ${JSON.stringify(name)})`;
const text = (t) => `(c) => c.getObjects().find((o) => o.text === ${JSON.stringify(t)})`;

async function openTab(d, name) {
  const active = await d.ev(`!!(${rail(name)})?.classList.contains("active")`);
  if (!active) await d.click(rail(name));
  await d.wait(0.6);
}

export const chapters = [
  {
    title: "Welcome",
    beats: [
      {
        say: "Hi, and welcome to Khulqidesign.",
        act: async (d) => { await d.wait(0.4); await d.moveTo(1100, 420, 1.2); },
      },
      {
        say: "In the next few minutes, I'll show you how to make a finished design in Create, our editor that works right in your browser.",
        act: async (d) => {
          await d.click(`[...document.querySelectorAll("header a, header button")].find(e => e.textContent.trim() === "Create")`);
          await d.wait(2.5);
        },
      },
      {
        say: "You don't need to install anything, and you can start without an account.",
        act: async (d) => { await d.moveTo(1000, 640, 1.0); },
      },
    ],
  },
  {
    title: "Start a design",
    beats: [
      {
        say: "Every design starts with a size. Pick one of the ready-made sizes, like Instagram Post, or type your own width and height.",
        act: async (d) => {
          await d.moveTo(1250, 420, 0.8);
          await d.moveTo(840, 710, 0.9);
          await d.wait(0.4);
          await d.click(btn("Instagram Post"));
          await d.wait(0.8);
        },
      },
      {
        say: "On the left, open Templates. Every template is made by our team, and you can change everything in it: the text, the colors and the pictures.",
        act: async (d) => {
          await openTab(d, "Templates");
          await d.wait(0.8);
          await d.moveTo(230, 420, 0.8);
          await d.moveTo(290, 700, 1.2);
        },
      },
      {
        say: "Let's pick this one. One click, and it's on your page.",
        act: async (d) => {
          await d.click(tpl("design week post"));
          await d.wait(1.5);
          await d.moveTo(1000, 560, 0.8);
        },
      },
    ],
  },
  {
    title: "Edit text",
    beats: [
      {
        say: "To change the text, just double-click it and type.",
        act: async (d) => {
          const p = await d.objAt(text("WEEK"));
          await d.clickAt(p.x, p.y, { n: 2 });
          await d.wait(0.2);
          await d.key("a", "KeyA", 65, 4);
          await d.type("DAYS", 7);
          await d.wait(0.6);
        },
      },
      {
        say: "With a text selected, the panel on the right shows everything you can change: the font, the size, bold and italic, spacing and alignment.",
        act: async (d) => {
          await d.click(`document.querySelector(".create-props")`, { s: 0.8 }).catch(() => {});
          await d.moveTo(1765, 285, 0.8); await d.wait(0.4);
          await d.moveTo(1705, 329, 0.5); await d.wait(0.3);
          await d.moveTo(1705, 416, 0.5); await d.wait(0.3);
          await d.click(btn("Align center"), { s: 0.4 });
          await d.wait(0.4);
          await d.click(btn("Align left"), { s: 0.3 });
        },
      },
      {
        say: "Every font in Create is free to use, for personal and commercial work.",
        act: async (d) => {
          await d.click(`document.querySelector(".fp-current")`);
          await d.wait(0.5);
          await d.type("Anton", 8);
          await d.wait(0.6);
          await d.click(`[...document.querySelectorAll(".fp-font")].find(b => b.textContent.trim().startsWith("Anton"))`);
          await d.wait(0.8);
        },
      },
      {
        say: "Want more text? Open the Text tab, and add a heading, a subheading or body text.",
        act: async (d) => {
          await openTab(d, "Text");
          await d.moveTo(230, 190, 0.6);
          await d.moveTo(230, 300, 0.8);
          await d.wait(0.4);
          await d.key("Escape", "Escape", 27);
        },
      },
    ],
  },
  {
    title: "Colors, photos and backgrounds",
    beats: [
      {
        say: "Select any element, and click its color to change it.",
        act: async (d) => {
          const g = await d.objAt(`(c) => c.getObjects().find(o => o.type === "group")`);
          await d.clickAt(g.x + 30, g.y + 40);
          await d.wait(0.5);
          await d.click(`[...document.querySelectorAll(".create-props button")].find(b => (b.getAttribute("aria-label")||"") === "Edit color #f4b400")`);
          await d.wait(0.6);
        },
      },
      {
        say: "Choose from the palette, type a hex code, or use the eyedropper to take a color from your design.",
        act: async (d) => {
          await d.moveTo(1765, 530, 0.7);
          await d.wait(0.3);
          await d.click(`document.querySelector('button[aria-label="Red, #ef4444"]')`);
          await d.wait(0.8);
          await d.moveTo(1765, 236, 0.7);
          await d.wait(0.6);
          await d.click(`document.querySelector(".cp-color-close")`);
        },
      },
      {
        say: "To use your own pictures, open Uploads and add your files. Each one lands right on your page.",
        act: async (d) => {
          await openTab(d, "Uploads");
          await d.upload(`document.querySelector(".cp-upload")`, [MEDIA + "ocean.jpg"]);
          await d.wait(1.4);
        },
      },
      {
        say: "Don't need something? Select it, and press Delete.",
        act: async (d) => {
          const p = await d.objAt(`(c) => c.getObjects().find(o => o.type === "image")`);
          await d.clickAt(p.x, p.y);
          await d.wait(0.4);
          await d.key("Delete", "Delete", 46);
          await d.wait(0.6);
        },
      },
      {
        say: "For a neater look, add a photo frame from Elements. Drag a corner to resize it, and move it into place.",
        act: async (d) => {
          await openTab(d, "Elements");
          await d.click(`[...document.querySelectorAll(".cp-cat")].find(b => b.title.startsWith("Photo frames"))`);
          await d.wait(0.6);
          await d.click(`[...document.querySelectorAll(".create-panel .cp-tile")].find(b => b.title === "Circle photo frame")`);
          await d.wait(0.8);
          const f = await d.objAt(`(c) => c.getObjects().find(o => o.kdFrame)`);
          const corner = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
          await d.dragMouse(corner, { x: f.x - f.w / 2 + f.w * 0.55, y: f.y - f.h / 2 + f.h * 0.55 }, 0.9);
          const g = await d.objAt(`(c) => c.getObjects().find(o => o.kdFrame)`);
          const to = await d.toScreen(205, 668);
          await d.dragMouse({ x: g.x, y: g.y }, to, 1.0);
        },
      },
      {
        say: "Then drag your picture from Uploads onto the frame. It fills the frame for you.",
        act: async (d) => {
          await openTab(d, "Uploads");
          const tile = await d.rectOf(`document.querySelector(".create-panel .cp-tile")`);
          const f = await d.objAt(`(c) => c.getObjects().find(o => o.kdFrame)`);
          await d.drag(tile, { x: f.x, y: f.y }, 1.1);
          await d.wait(0.8);
        },
      },
      {
        say: "Double-click the picture to move or crop it inside the frame.",
        act: async (d) => {
          const f = await d.objAt(`(c) => c.getObjects().find(o => o.kdFrame)`);
          await d.clickAt(f.x, f.y, { n: 2 });
          await d.wait(0.8);
          await d.dragMouse({ x: f.x, y: f.y }, { x: f.x - 40, y: f.y + 10 }, 0.8);
          await d.wait(0.4);
          await d.click(`[...document.querySelectorAll("button")].find(b => b.offsetParent && b.textContent.trim() === "Done")`);
          await d.wait(0.6);
        },
      },
      {
        say: "And the Background tab gives you colors and ready-made backgrounds for the whole page.",
        act: async (d) => {
          await openTab(d, "Background");
          await d.moveTo(150, 215, 0.7);
          await d.moveTo(300, 300, 0.9);
          await d.moveTo(170, 480, 0.9);
          await d.wait(0.6);
        },
      },
    ],
  },
  {
    title: "Elements",
    beats: [
      {
        say: "The Elements tab holds the pieces you can add: icons, graphics, shapes, photo frames, tables, and even QR codes.",
        act: async (d) => {
          await openTab(d, "Elements");
          await d.ev(`document.querySelector(".cp-back")?.click()`);
          await d.wait(0.4);
          await d.moveTo(160, 260, 0.6);
          await d.moveTo(160, 520, 1.6);
          await d.wait(0.3);
        },
      },
      {
        say: "Search for what you need. Let's try idea. Then click it to add it to your page.",
        act: async (d) => {
          await d.click(`document.querySelector(".create-panel input")`);
          await d.type("idea", 7);
          await d.waitFor(`document.querySelector(".create-panel .cp-tile")`, 10);
          await d.wait(0.8);
          await d.click(`document.querySelector(".create-panel .cp-tile")`);
          await d.wait(0.8);
          const ic = await d.objAt(`(c) => c.getActiveObject()`);
          const to = await d.toScreen(905, 170);
          await d.dragMouse({ x: ic.x, y: ic.y }, to, 0.9);
        },
      },
      {
        say: "Icons and shapes stay sharp at any size, and you can recolor them in one click.",
        act: async (d) => {
          await d.click(`[...document.querySelectorAll(".create-props button")].find(b => (b.getAttribute("aria-label") || "").startsWith("Edit color #"))`);
          await d.wait(0.5);
          await d.click(`document.querySelector('button[aria-label="Yellow, #facc15"]')`);
          await d.wait(0.6);
          await d.click(`document.querySelector(".cp-color-close")`);
        },
      },
      {
        say: "Items marked with a crown are Premium. You can try them in your design freely; they only need Premium when you download.",
        act: async (d) => {
          await d.ev(`(() => { const i = document.querySelector(".create-panel input"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, ""); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
          await d.wait(0.5);
          await d.click(`[...document.querySelectorAll(".cp-cat")].find(b => b.title.startsWith("Graphics"))`);
          await d.wait(0.8);
          const crown = await d.rectOf(`document.querySelector(".create-panel .cp-crown")`).catch(() => null);
          if (crown) await d.moveTo(crown.x - 20, crown.y + 20, 0.9);
          await d.wait(1.2);
        },
      },
    ],
  },
  {
    title: "Pages, layers and resize",
    beats: [
      {
        say: "A design can have many pages, great for carousels and presentations. Add a new page, or duplicate this one to keep its style.",
        act: async (d) => {
          await d.key("Escape", "Escape", 27);
          await d.moveTo(1000, 910, 0.8);
          await d.wait(0.5);
          await d.click(`document.querySelector('button[aria-label="Duplicate page"], button[title="Duplicate page"]')`);
          await d.wait(1.2);
        },
      },
      {
        say: "The Layers tab shows everything on the page. Lock anything you don't want to move by accident.",
        act: async (d) => {
          await openTab(d, "Layers");
          await d.moveTo(200, 200, 0.6);
          await d.moveTo(200, 420, 1.0);
          await d.click(`[...document.querySelectorAll(".create-panel button")].find(b => (b.getAttribute("aria-label") || b.title || "") === "Lock DESIGN")`);
          await d.wait(0.6);
        },
      },
      {
        say: "Need the same design in another size? Choose Resize design, and pick a new size. Copy and resize keeps your original as it is.",
        act: async (d) => {
          await d.key("Escape", "Escape", 27);
          await d.click(`[...document.querySelectorAll("button")].find(b => b.offsetParent && b.textContent.trim() === "Resize design")`);
          await d.wait(0.6);
          await d.click(`[...document.querySelectorAll(".create-modal button")].find(b => b.textContent.trim().startsWith("Story / Reels"))`);
          await d.wait(0.4);
          await d.click(`[...document.querySelectorAll(".create-modal button")].find(b => b.textContent.trim() === "Copy & resize")`);
          await d.wait(2.0);
        },
      },
    ],
  },
  {
    title: "Animate",
    beats: [
      {
        say: "To bring a page to life, select an element, and open Animate in the panel on the right.",
        act: async (d) => {
          const p = await d.objAt(`(c) => c.getObjects().find(o => o.text === "DAYS")`);
          await d.clickAt(p.x, p.y);
          await d.wait(0.4);
          await d.click(`[...document.querySelectorAll(".create-props button, .create-props h3, .create-props summary")].find(e => /^animate/i.test(e.textContent.trim()))`);
          await d.wait(0.6);
        },
      },
      {
        say: "Pick an effect, and press play to preview it. Animated pages can be downloaded as a video or a GIF.",
        act: async (d) => {
          await d.click(`document.querySelector(".create-props .at-rise")`);
          await d.wait(0.5);
          await d.click(`document.querySelector(".create-props .pp-play")`);
          await d.wait(2.6);
        },
      },
    ],
  },
  {
    title: "Download and your projects",
    beats: [
      {
        say: "When you're happy, click Download. PNG gives you the best quality, JPG a smaller file, SVG a scalable vector, and PDF every page at print quality.",
        act: async (d) => {
          await d.key("Escape", "Escape", 27);
          await d.click(`[...document.querySelectorAll(".create-topbar button")].find(b => b.textContent.trim() === "Download")`);
          await d.wait(0.6);
          for (const f of ["PNG", "JPG", "SVG", "PDF"]) {
            const r = await d.rectOf(`[...document.querySelectorAll(".create-topbar button")].find(b => b.textContent.trim().startsWith(${JSON.stringify(f)}))`);
            await d.moveTo(r.x - 40, r.y, 0.45);
            await d.wait(0.5);
          }
        },
      },
      {
        say: "Animated pages can also be saved as MP4 or GIF. The first time you download, we'll ask you to log in. A free account gives you ten downloads a day.",
        act: async (d) => {
          const mp4 = await d.rectOf(`[...document.querySelectorAll(".create-topbar button")].find(b => b.textContent.trim().startsWith("MP4"))`).catch(() => null);
          if (mp4) { await d.moveTo(mp4.x - 40, mp4.y, 0.5); await d.wait(0.6); }
          await d.click(`[...document.querySelectorAll(".create-topbar button")].find(b => b.textContent.trim().startsWith("PNG"))`);
          await d.wait(2.0);
        },
      },
      {
        say: "Your work saves as you go; you'll see Saved at the top. Find all your designs again in the Projects tab.",
        act: async (d) => {
          await d.key("Escape", "Escape", 27);
          await d.ev(`[...document.querySelectorAll("[role=dialog] button, .create-modal button")].find(b => /cancel|not now|close|×|✕/i.test(b.textContent.trim() || b.getAttribute("aria-label") || ""))?.click()`);
          await d.wait(0.5);
          const saved = await d.rectOf(`[...document.querySelectorAll(".create-topbar *")].find(e => e.children.length === 0 && e.textContent.trim() === "Saved")`).catch(() => null);
          if (saved) { await d.moveTo(saved.x, saved.y + 4, 0.8); await d.wait(0.8); }
          await openTab(d, "Projects");
          await d.moveTo(200, 300, 0.8);
          await d.wait(0.6);
        },
      },
    ],
  },
  {
    title: "Wrap-up",
    beats: [
      {
        say: "And that's it: from a template to a finished design, in a few minutes.",
        act: async (d) => {
          await d.click(`[...document.querySelectorAll(".create-panel .cp-project-main")].at(-1)`);
          await d.wait(1.2);
          await d.click(`document.querySelector('button[aria-label="Hide panel"], button[title="Hide panel"]')`).catch(() => {});
          await d.click(`document.querySelector('button[aria-label="Hide properties"], button[title="Hide properties"]')`).catch(() => {});
          await d.wait(0.8);
          await d.moveTo(1880, 1040, 0.8);
        },
      },
      {
        say: "Explore the templates, try your own colors and pictures, and have fun creating. Thanks for watching, and see you in the next tutorial.",
        act: async (d) => { await d.wait(1.5); },
      },
    ],
  },
];
