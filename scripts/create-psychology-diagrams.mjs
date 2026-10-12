import { writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('../public/guides/psychology/', import.meta.url);
mkdirSync(dir, { recursive: true });
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const diagrams = {
  deployment: ['From your browser to the web', 'One public website. A CMS you can still edit.', [
    ['SOURCE / PLAYGROUND', 'Keep a full ZIP backup', 'Export content as XML', 'Collect images and design notes'],
    ['LIVE / WORDPRESS HOST', 'Import content and upload images', 'Restore theme, styles and menu', 'Publish at your HTTPS address'],
    ['VERIFY / HAND OVER', 'Test while signed out', 'Make a live CMS edit', 'Submit URL and recovery notes'],
  ], 'A Playground ZIP is a backup. Deployment needs a public host and a working CMS.'],
  workspace: ['Your workspace, at a glance', 'Three tabs. One place to keep your work.', [
    ['LAB INSTRUCTIONS', 'Read the next task', 'Check the expected result', 'Tick Done when finished'],
    ['WORDPRESS', 'Build and preview the site', 'Save your changes', 'Export your ZIP backup'],
    ['AI ASSISTANT', 'Give a clear prompt', 'Check the draft', 'Ask for one improvement'],
  ], 'COURSE FOLDER  /  Backups  /  Images  /  Notes'],
  sitemap: ['Seven pages. One clear menu.', 'A sitemap plans where visitors will go.', [
    ['HOME', 'Welcome and introduction', 'A clear next step', 'Links to the main pages'],
    ['ABOUT / SERVICES / TEAM', 'Who the clinic is', 'What it offers', 'Who works there'],
    ['CONDITIONS / RESOURCES / CONTACT', 'Informational articles', 'Helpful reading', 'Fictional contact details'],
  ], 'HOME → MENU LINKS → EACH PAGE  •  Test every link in the site preview'],
  content: ['Page, post or category?', 'Choose the right home for your content.', [
    ['PAGE', 'Lasting information', 'Example: About the clinic', 'Usually linked in the menu'],
    ['POST', 'A dated article', 'Example: a student newsletter', 'Shown in a list of posts'],
    ['CATEGORY', 'A group of related posts', 'Example: Resources', 'Helps readers find a topic'],
  ], 'A theme changes the design. Your pages and posts hold the content.'],
  prompt: ['A better prompt starts with context', 'Use this recipe, then review what comes back.', [
    ['01 / AUDIENCE + TASK', 'Who will read this?', 'What page are you making?', 'What should the reader learn?'],
    ['02 / CONSTRAINTS', 'State the length and tone', 'Name the required sections', 'Use fictional details'],
    ['03 / REVIEW + REVISE', 'Check every claim', 'Remove invented facts', 'Ask for a specific improvement'],
  ], 'YOU MAKE THE FINAL DECISION  •  A fluent answer still needs checking'],
  backup: ['Save is not the same as back up', 'Keep your work ready for the next session.', [
    ['01 / SAVE THE EDIT', 'Save in the WordPress editor', 'Then store the Playground', 'Look for the Saved status'],
    ['02 / EXPORT THE SITE', 'Dock → Export', 'Download as .zip', 'Keep a second copy'],
    ['03 / RESTORE + CHECK', 'Dock → New → Import zip', 'Open your exported file', 'Check your own pages and text'],
  ], 'SESSION 1: mindcare-session1.zip  →  SESSION 2: restore and keep building'],
  code: ['From an idea to a working block', 'Make small changes you can understand.', [
    ['READ + EDIT', 'Find the value to change', 'Change one thing', 'Keep the original nearby'],
    ['TEST IN THE SANDBOX', 'Run the preview', 'Check narrow and wide views', 'Fix problems before copying'],
    ['USE IN WORDPRESS', 'Add a Custom HTML block', 'Paste the working code', 'Preview, then save'],
  ], 'IF IT BREAKS: undo the last change, test again, then ask for help'],
};
for (const [name, [title, subtitle, cards, footer]] of Object.entries(diagrams)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="570" viewBox="0 0 1200 570" role="img" aria-labelledby="title desc"><title id="title">${escape(title)}</title><desc id="desc">${escape(subtitle)}</desc><rect width="1200" height="570" rx="24" fill="#101e25"/><g font-family="Arial, sans-serif"><text x="48" y="64" fill="#99cbb8" font-size="14" letter-spacing="3">MINDCARE / VISUAL GUIDE</text><text x="48" y="118" fill="#f6f7f3" font-size="38" font-weight="700">${escape(title)}</text><text x="48" y="154" fill="#bbc9cc" font-size="21">${escape(subtitle)}</text>${cards.map(([heading, ...lines], i) => { const x = 48 + i * 376; return `<rect x="${x}" y="204" width="352" height="236" rx="16" fill="#1e313a" stroke="#47625f"/><rect x="${x + 22}" y="230" width="42" height="5" rx="2" fill="#99cbb8"/><text x="${x + 22}" y="274" fill="#b5e2cf" font-size="${heading.length > 25 ? 14 : 18}" font-weight="700">${escape(heading)}</text>${lines.map((line, j) => `<text x="${x + 22}" y="${320 + j * 36}" fill="#edf2f0" font-size="18">${escape(line)}</text>`).join('')}`; }).join('')}<text x="48" y="505" fill="#b5e2cf" font-size="18">${escape(footer)}</text><text x="48" y="542" fill="#849b9f" font-size="13">Teaching illustration · not a software screenshot</text></g></svg>`;
  writeFileSync(new URL(`${name}.svg`, dir), svg);
}
console.log(`Created ${Object.keys(diagrams).length} diagrams.`);
