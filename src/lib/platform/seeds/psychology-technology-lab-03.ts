import { sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';

/** Hosting is supplied by the instructor; this lesson never purchases or provisions a hosting account. */
export function psychologyTechnologyLab03(): Flow {
  const nodes: Flow['nodes'] = [];
  const add = (id: string, type: LabNodeType, data: Record<string, string>) => nodes.push({ id, type, x: 100, y: 100 + nodes.length * 145, data });
  const task = (id: string, title: string, time: number, steps: string[], check: string) => {
    add(id, 'task', { title, time: `${time} min`, body: steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + `\n\n**Check before moving on:** ${check}` });
  };
  add('root', 'start', {
    title: 'Lab 03 — Deploy Your Live CMS Website', difficulty: 'Beginner', estimatedTime: '2 hours',
    description: 'Move your MindCare site from the browser to an instructor-provided WordPress host, test it as a public visitor and prove that the live site is still editable through its CMS.',
    objectives: 'Distinguish a browser practice site, a backup and a public deployment\nTransfer pages, posts and media to hosted WordPress\nRestore the theme, homepage, navigation and styles\nTest HTTPS, links and images while signed out\nPublish an update through the live CMS\nPrepare a public URL, evidence and a recovery plan',
  });
  add('instructor', 'callout', { tone: 'NOTE', body: '**Instructor preparation — required before this session**\n\nProvide each student or pair with an empty, dedicated WordPress installation, its public HTTPS URL and a private administrator invitation/login. Pre-install Twenty Twenty-Five, WordPress Importer and Blocks Animation, or allow students to install them. Enable HTTPS, confirm media uploads and provide the institution’s approved backup/restore procedure. Confirm the site is publicly viewable and state when the hosting expires. Run this lesson once on the actual teaching host before class.\n\nStudents do not need to buy a domain or hosting. A provided subdomain is sufficient. Do not use a shared production site or an existing clinic website. If hosting is not ready, the class can prepare its files but cannot complete the live-deployment outcome.' });
  add('part-deployment', 'part', { title: 'Session 3 — From practice site to public website', time: '2 hours' });
  task('task-destination', 'Identify the two sites and check your hosting access', 10, [
    'Keep your completed Playground site open in a tab labelled SOURCE in your notes. Restore your Session 2 ZIP there if necessary.',
    'Open the public site URL provided by your instructor in a second tab. Label it LIVE in your notes.',
    'Open the provided admin login, usually the public address followed by /wp-admin/. Sign in privately with your own account. Never put the password in your submission.',
    'Confirm this is your assigned empty teaching site. Check that you can open Pages, Media and Appearance. Ask your instructor to resolve missing permissions before importing.',
    'Open the public URL in a signed-out browser window. It should show a website over HTTPS, even if it is still the default site.',
  ], 'You have a public HTTPS address, a working live Dashboard and the correct empty destination. A Playground URL or ZIP does not meet this check.');
  add('visual-deployment', 'image', { src: '/guides/psychology/deployment.svg', alt: 'Transfer content and images from Playground to hosted WordPress, then test the public site and update it through the live Dashboard.', caption: 'Deployment keeps two things working: a public website for visitors and a private CMS for its editors.' });
  add('quiz-live', 'quiz', { question: 'Which result proves you have a live CMS website?', options: '*A signed-out visitor opens the HTTPS site, and I can edit it through the hosted WordPress Dashboard\nA ZIP is saved on my laptop\nThe Playground editor says Publish\nA screenshot of my homepage', explain: 'A deployed site must be reachable by other visitors. A working CMS must also let its authorised editor update the hosted content.' });
  task('task-pack', 'Prepare a transfer folder and protect your source', 10, [
    'In Playground, save your changes and use Dock → Export → Download as .zip. Keep this full practice-site backup unchanged.',
    'Create a Deployment folder containing Content, Images and Evidence subfolders.',
    'Keep the original image files you used. If an original is missing, open it in the source Media Library and download/save the full image to your Images folder.',
    'Write down the theme name, colour values, font choices, homepage selection and navigation order. Take reference screenshots of the homepage and menu.',
    'Ask the instructor how to restore the destination if an import goes wrong. Confirm it is empty before continuing.',
  ], 'Your source remains available, your ZIP exists and you have the images and design notes needed for a transfer.');
  add('format-guide', 'callout', { tone: 'CAUTION', body: '**Three files, three purposes**\n\n- **Playground ZIP:** restores your practice environment in Playground. Do not upload its database or wp-config.php over the hosted installation.\n- **WordPress XML:** transfers content through Tools → Export / Import. It is not a full-site backup and does not install your theme or plugins.\n- **Image files:** upload these separately when the live host cannot retrieve them from browser-only Playground URLs.\n\nThis lesson uses content transfer and design reconfiguration, not a raw SQLite-to-host database copy.' });
  task('task-export-content', 'Export the source content as WordPress XML', 10, [
    'In the SOURCE WordPress Dashboard, choose Tools → Export. This is different from the Playground Dock’s Export menu.',
    'Select All content, then Download Export File. Save the XML in Deployment/Content.',
    'Make an inventory: the seven required pages, your posts and categories. Note anything that is still a draft.',
    'If the source cannot open or export, stop and recover it with the instructor; do not treat the Playground ZIP as a WordPress XML import.',
  ], 'You have an .xml export and an inventory to compare against the live site.');
  add('path-export-content', 'clickpath', { title: 'Source WordPress content export', steps: 'SOURCE Dashboard\nTools\nExport\nAll content\nDownload Export File' });
  add('export-reference', 'link', { title: 'WordPress: content export and import', url: 'https://learn.wordpress.org/lesson/tools-export-and-import/', description: 'Official explanation of what an XML transfer includes and what must be configured separately.', cta: 'Read the reference' });
  task('task-import-content', 'Import the content into the live CMS', 15, [
    'In the LIVE Dashboard, choose Tools → Import → WordPress. Use Install Now if available, then Run Importer. If installation is restricted, ask your instructor to enable the importer.',
    'Choose the XML you exported and select Upload file and import.',
    'Assign imported content to your own existing teaching account. Do not create accounts for fictional clinic staff.',
    'You may request Download and import file attachments, but images whose source addresses exist only inside Playground may fail. Keep the report and fix those images in the next task.',
    'After the import finishes, compare Pages and Posts against your inventory. Check categories and draft/published status. Do not repeat an import blindly if it reports errors: inspect for duplicates first.',
  ], 'Every required page and post appears in the live Dashboard, or you have identified the exact missing items.');
  add('path-import-content', 'clickpath', { title: 'Live WordPress content import', steps: 'LIVE Dashboard\nTools\nImport\nWordPress → Run Importer\nUpload XML\nAssign author\nReview import report' });
  task('task-media-live', 'Move images and repair links', 20, [
    'Open LIVE Media → Add New Media File and upload the images that did not migrate. Keep the filenames and credits organised.',
    'Edit each page/post with a missing image. Select its Image or Cover block and replace the source with the corresponding file from the LIVE Media Library.',
    'Re-enter meaningful alt text and image credits. Inspect featured images and any background images too.',
    'Review buttons, text links and Custom HTML blocks. Replace source/Playground addresses with the matching live page URLs. Re-select internal pages through the link picker where possible.',
    'Preview every page and post. A visible image while logged into the source is not enough: the live visitor must be able to load it independently.',
  ], 'Images and links use the live site or intended public resources, not temporary Playground addresses.');
  add('visual-media-live', 'image', { src: '/guides/psychology/alt-text.png', alt: 'WordPress Alternative Text field for an image.', caption: 'After uploading an image to the live Media Library, check its alternative text again.' });
  task('task-design-live', 'Restore the theme, homepage and navigation', 15, [
    'In LIVE Appearance → Themes, activate Twenty Twenty-Five. If it is missing, ask the instructor to install it or use Add New Theme when permitted.',
    'Use your design notes to reapply the palette and typography in Appearance → Editor → Styles. Content import alone does not reproduce all source design settings.',
    'Under Settings → Reading, select a static homepage and choose Home; choose Resources as the posts page if that was your source setup.',
    'Open Appearance → Editor and check the header Navigation block. Rebuild/reorder links to the live pages as needed and save the changes.',
    'Check that Blocks Animation is installed and active if you used it. Test Custom HTML and animation on the host; if code was removed or restricted, ask the instructor and use a normal core block as a readable fallback.',
  ], 'Your live site has the correct homepage, menu and consistent design, with readable content even if an animation is unavailable.');
  task('task-public', 'Make the teaching site publicly reachable', 10, [
    'Use the live host’s provided launch/visibility control to remove a coming-soon page, or ask the instructor to do it. Do not change domain or WordPress Address settings at random.',
    'Publish the pages and posts meant for visitors. Leave unfinished practice pages as drafts.',
    'Verify the HTTPS address and check for certificate warnings. If HTTPS is not working, ask the host/instructor to fix it before proceeding.',
    'Keep the fictional-clinic/educational disclaimer visible. Remove real personal contact information and any form that appears to accept real patient details.',
    'Open the public address while signed out. Note that Settings → Reading’s search-engine indexing option is not a privacy switch; a public teaching site can remain unindexed.',
  ], 'A signed-out visitor sees your actual homepage over HTTPS without an admin login or coming-soon screen.');
  task('task-test-live', 'Run a visitor test on another device', 10, [
    'Ask a classmate to open your public URL on their phone or laptop without your account.',
    'Test all seven menu destinations, one post from each category, every main button and the contact page.',
    'Check image loading, readable text and the layout at a narrow screen width. Confirm no link opens your Playground instance.',
    'Record any broken link, missing image or blocked page. Fix it in the LIVE Dashboard and ask the classmate to retest.',
  ], 'Another person can browse the live site, and your recorded issues are resolved.');
  task('task-cms-proof', 'Prove that the deployed CMS works', 10, [
    'In the LIVE Dashboard, edit a harmless sentence on the About page, such as a short educational project note.',
    'Save/Update the page. Refresh the same page in the signed-out visitor window.',
    'Confirm the new sentence appears. If the host caches pages, use its documented cache-refresh action or ask the instructor; do not edit the source site by mistake.',
    'Capture one screenshot of the public change and one of the matching live editor. Keep account details and other browser tabs out of screenshots.',
  ], 'An edit made in hosted WordPress changes the public website. You have deployed a working CMS, not only static HTML.');
  task('task-handover', 'Submit the live website and recovery notes', 10, [
    'Create deployment-notes.txt with the public HTTPS URL, your student identifier, deployment date and the source/host used.',
    'Add the visitor-test checklist, homepage/mobile screenshots and the CMS update evidence. State any remaining limitation honestly.',
    'Record where the instructor-approved hosted backup is kept and how to request a restore. Keep the source ZIP and XML too; XML alone is not a full backup of the live site.',
    'Record the hosting expiry date and who maintains the site. Submit through the channel specified by your instructor; this lab does not create an upload portal.',
    'Never submit a password, recovery code, full database or hosting token. Tick the task only after the public URL and evidence are ready.',
  ], 'Your handover includes a working public URL, CMS-edit proof, visitor-test evidence and a recovery plan.');
  add('check-live', 'checkpoint', { body: '**Definition of done:** public HTTPS URL works while signed out; seven pages, posts, menu and images work; a live CMS edit is visible publicly; the fictional-site disclaimer remains; deployment evidence and recovery notes are complete. A Playground URL, ZIP, static screenshot or local-only address does not count as deployment.' });
  add('checkin', 'checkin', {});
  const clean = sanitizeFlow({ nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id })) }, 'lab');
  if (!clean.ok) throw new Error(clean.error);
  return clean.value;
}
