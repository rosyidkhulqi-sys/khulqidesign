// The modifier key as people see it on their keyboard: ⌘ on a Mac, Ctrl
// elsewhere, for shortcut tooltips across Create.
export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
