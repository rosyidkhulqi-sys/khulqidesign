// Terms of Service and Privacy Policy, as data so the Legal page can render
// both with a table of contents. DRAFT: written in plain words to match
// Pricing and License; have a lawyer check them before taking payments.
//
// Placeholders the owner should confirm:
//   OWNER    the business name in the documents
//   refunds  14 days if nothing was downloaded and no AI credits were used,
//            minus the payment provider's fees; cancelling is not a refund
// Each section is [id, heading, [paragraphs...]].

export const OWNER = "Khulqi Design";
export const COUNTRY = "Indonesia";
export const CONTACT = "khulqidesign@mail.com";
export const UPDATED = "November 2026";

export const terms = [
  ["about", "About these terms", [
    `These terms are an agreement between you and ${OWNER}, based in ${COUNTRY}, the owner of Khulqidesign. By creating an account, downloading or buying anything here, you accept them.`,
    `Questions about these terms: ${CONTACT}.`,
  ]],
  ["accounts", "Your account", [
    "Give accurate details and keep your login to yourself. An account is for one person; sharing it with others isn't allowed.",
    "You're responsible for what happens under your account. Tell us right away if you think someone else has access to it.",
  ]],
  ["plans", "Plans and billing", [
    "Premium is billed in US dollars, monthly or yearly, and renews automatically until you cancel. Taxes may be added depending on where you live.",
    "You can cancel anytime from your account. Premium stays active until the end of the period you've paid for; we don't charge again after that.",
    "If prices change, we'll tell you by email at least 30 days before your next renewal. Founding members keep their price for as long as their subscription stays active without a break.",
    "Payments are handled by our payment provider. We never see or store your full card number.",
  ]],
  ["refunds", "Refunds", [
    "Cancelling stops future renewals; it isn't a refund. Premium stays active until the end of the period you've paid for.",
    "If you haven't downloaded anything and haven't used AI credits, you can ask for a refund within 14 days of your first payment or renewal. We return what you paid minus the payment provider's processing fees, which are not returned to us.",
    "Once files have been downloaded or credits used, that period isn't refundable, because the files can't be returned.",
    "Exclusive logos can't be refunded once the files have been delivered, since the logo is taken off sale for everyone else.",
  ]],
  ["downloads", "Downloads and fair use", [
    "Free accounts can download 10 files a day. Premium downloads are unlimited under fair use: what one person needs for their own projects.",
    "Bulk or automated downloading, scraping and using scripts or bots are not allowed. If an account downloads far more than normal use, we may pause it while we check.",
    "Every download is recorded to your account as proof of your license.",
  ]],
  ["licenses", "Licenses", [
    "What you may do with each file is set out on the License page, which is part of these terms.",
    "You may not resell, share or redistribute files as they are, upload them to other stock or print-on-demand sites, or use them to train AI models.",
  ]],
  ["exclusive", "Exclusive logos", [
    "An Exclusive logo is sold to one buyer only. When payment is complete, the logo is taken off sale and the files and rights pass to you, including the right to register it as a trademark.",
    "We may keep showing the logo in our portfolio, marked Sold.",
  ]],
  ["ai", "AI tools and credits", [
    "Some tools that create new images or video use credits. How many credits each tool uses, and how long credits last, is shown when you buy or use them.",
    "Don't use the tools to make anything illegal, hateful, misleading, or that copies someone else's work or likeness without permission. Results can be imperfect; check them before you use them.",
  ]],
  ["content", "Your designs and uploads", [
    "Designs you make in Create and files you upload stay yours. You give us permission to store and process them only so the tools can work for you.",
    "Only upload things you have the right to use.",
  ]],
  ["ip", "Our content", [
    `The site, its tools and every asset belong to ${OWNER} or its contributors. A license lets you use files as described; it doesn't transfer ownership, except for Exclusive logos.`,
  ]],
  ["suspension", "Suspension and closing accounts", [
    "We may suspend or close accounts that break these terms, for example by reselling files or bulk downloading. When an account is closed for misuse, its licenses for files used in that misuse end.",
    "You can close your account anytime by emailing us.",
  ]],
  ["liability", "Liability", [
    "We work to keep the site running and the files accurate, but they're provided as they are. To the extent the law allows, our liability for any claim is limited to what you paid us in the 12 months before it.",
  ]],
  ["changes", "Changes and governing law", [
    "We may update these terms. If a change matters, we'll tell you by email or on the site before it takes effect.",
    `These terms are governed by the laws of ${COUNTRY}.`,
  ]],
];

export const privacy = [
  ["collect", "What we collect", [
    "Account details: your name and email, or the profile your sign-in provider (such as Google) shares with us.",
    "Activity: what you download, save and create, and your download history, so we can show it to you and prove your licenses.",
    "Payments: your plan, invoices and payment status. Card details go to our payment provider, not to us.",
    "Technical data: browser, device and rough location from your IP address, to keep the site secure and working.",
  ]],
  ["use", "How we use it", [
    "To run your account, deliver downloads, record licenses, bill your plan and answer your questions.",
    "To spot misuse such as bulk downloading or shared accounts.",
    "To improve the site. We don't sell your personal data, and we don't use your designs to train AI.",
  ]],
  ["share", "Who we share it with", [
    "Only the services that help us run Khulqidesign: sign-in and database (Supabase), hosting and file storage, our payment provider, and email delivery. They may only use your data to provide that service.",
    "We also share data when the law requires it.",
  ]],
  ["cookies", "Cookies and local storage", [
    "We use cookies and your browser's storage to keep you signed in and to remember things like your download history and editor projects on this device. We don't use advertising cookies.",
  ]],
  ["keep", "How long we keep it", [
    "We keep your account data while your account is open. Download and payment records are kept as long as needed for your licenses and for tax and accounting rules.",
  ]],
  ["rights", "Your rights", [
    `You can ask to see, correct, export or delete your data at any time by emailing ${CONTACT}. Deleting your account removes your personal data, except records we must keep by law.`,
    "If you live in the EU or UK, you also have the rights set out in the GDPR, including complaining to your local data protection authority.",
  ]],
  ["children", "Children", [
    "Khulqidesign isn't meant for children under 16, and we don't knowingly collect their data.",
  ]],
  ["changes", "Changes and contact", [
    "If we change this policy in a way that matters, we'll tell you before it takes effect.",
    `${OWNER}, ${COUNTRY}. Contact: ${CONTACT}.`,
  ]],
];
