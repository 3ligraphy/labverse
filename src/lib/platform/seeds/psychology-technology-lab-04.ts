import { sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';
import { PLAYGROUND_FALLBACK } from '../playground.ts';

const text = (...lines: string[]) => lines.join('\n');

/** A fresh WordPress Playground for the capstone: Twenty Twenty-Five and Contact Form 7, opened on the Dashboard. */
export const CAPSTONE_PLAYGROUND_URL = 'https://playground.wordpress.net/?theme=twentytwentyfive&plugin=contact-form-7&url=/wp-admin/&page-title=My%20Psychology%20Website';

const WIREFRAME = `<style>
  *{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:#1f2d2a;background:#f6faf8}
  header{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:#fff;border-bottom:1px solid #dce8e3}
  .logo{font-weight:700;color:#2f6f5e}nav a{margin-left:14px;color:#1f2d2a;text-decoration:none;font-size:14px}
  .hero{padding:48px 22px;text-align:center;background:linear-gradient(135deg,#e3f1ec,#f6faf8)}
  .hero h1{margin:0 0 10px;font-size:30px;animation:rise .8s ease-out both}
  .hero p{margin:0 auto 18px;max-width:520px;animation:rise .8s .15s ease-out both}
  .btn{display:inline-block;padding:10px 18px;border-radius:999px;background:#2f6f5e;color:#fff;text-decoration:none}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;padding:26px 22px}
  .card{background:#fff;border:1px solid #dce8e3;border-radius:12px;padding:16px}
  .card h3{margin:0 0 6px;font-size:16px}.card p{margin:0;font-size:14px}
  footer{padding:16px 22px;font-size:12px;background:#1f2d2a;color:#dce8e3}
  @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){.hero h1,.hero p{animation:none}}
</style>
<header><span class="logo">Bright Path Psychology</span><nav><a href="#">About</a><a href="#">Services</a><a href="#">Resources</a><a href="#">FAQ</a><a href="#">Contact</a></nav></header>
<section class="hero"><h1>Feel more like yourself again</h1><p>Evidence-based talking therapy for adults living with anxiety and low mood.</p><a class="btn" href="#">Book a first conversation</a></section>
<section class="cards">
  <div class="card"><h3>Individual CBT</h3><p>Weekly sessions that build practical coping skills.</p></div>
  <div class="card"><h3>Online sessions</h3><p>Meet your therapist from home by video call.</p></div>
  <div class="card"><h3>Free resources</h3><p>Short articles on sleep, stress and worry.</p></div>
</section>
<footer>Fictional clinic created for a university course. Not a real service and not medical advice. In an emergency, call your local emergency number.</footer>`;

type Step = { id: string; type: LabNodeType; data: Record<string, string> };

/**
 * Lab 04 — the capstone: one ~2-hour session in which each student builds a complete WordPress website on their own,
 * from the brief to the backup (plan → set up → design → pages → posts → media → menu → form → quality → hand-in).
 * It repeats the Lab 01–02 skills without step-by-step hand-holding, adds the parts a real site needs (settings,
 * permalinks, logo, FAQ, contact form, privacy page, quality checks) and stays in Playground, so nothing is installed.
 */
function capstoneSteps(): Step[] {
  const steps: Step[] = [];
  const add = (id: string, type: LabNodeType, data: Record<string, string>) => { steps.push({ id, type, data }); };
  const task = (id: string, title: string, time: number, ...body: string[]) => add(id, 'task', { title, time: `${time} min`, body: text(...body) });
  const stuck = (id: string, title: string, ...lines: string[]) => add(id, 'callout', { tone: 'WARNING', body: text(`**Stuck? ${title}**`, '', ...lines) });

  add('root', 'start', {
    title: 'Lab 04 — Build a Full WordPress Website from A to Z', difficulty: 'Beginner', estimatedTime: '2 hours',
    description: 'Build a complete website for a fictional psychology service on your own, from the brief to the backup: plan it, set up WordPress, design it, write the pages and posts, add a menu, a contact form and a privacy page, check its quality and hand it in.',
    objectives: text(
      'Turn a short brief into a sitemap and a content list',
      'Set up a new WordPress site: title, tagline, permalinks and comments',
      'Give the site one consistent design: style, colours, fonts and logo',
      'Build six pages with patterns, plus posts sorted into categories',
      'Add a static homepage, a navigation menu, a contact form and a privacy page',
      'Check the site on a phone, for accessibility and for search, then back it up',
    ),
  });
  add('intro-callout', 'callout', { tone: 'NOTE', body: text(
    '**This lab puts everything together.** In Labs 01–03 you followed the MindCare example step by step. Today you build a **new** website on your own, from **A** (the plan) to **Z** (the backup).',
    '',
    'You need the same three tabs as before: these instructions, WordPress Playground and ChatGPT. Forgotten a word? The glossary is in Lab 01, and the **Setup** tab of this module has the workspace steps.',
  ) });

  add('part-capstone', 'part', { title: 'Session 4 — Your website, from A to Z', time: '2 hours' });

  /* A — plan */
  task('task-brief', 'A. Choose your brief and plan the website', 15,
    '**Why this matters:** a website built without a plan becomes a pile of pages. Ten minutes of planning saves an hour of rebuilding.', '',
    '**Choose one brief.** All three are fictional; do not use a real clinic, real people or real patient stories.', '',
    '- **Bright Path Psychology** — a small private practice offering CBT for adults with anxiety and low mood.',
    '- **Campus Calm** — a university student-wellbeing hub with workshops, self-help guides and drop-in hours.',
    '- **Mind & Memory Lab** — a university research group that explains its memory research and invites volunteers to an information session.', '',
    '**What to do**', '',
    '1. Write the brief name, the main audience and the **one action** a visitor should take (for example: book a call, join a workshop, ask about a study).',
    '2. Copy the prompt below into ChatGPT and fill in the [brackets].',
    '3. Read the answer critically. Keep **six pages**: Home, About, Services (or Workshops / Our research), Resources, FAQ and Contact. Remove anything that diagnoses, promises a cure or asks visitors for health details.',
    '4. Save the sitemap and content list in a notes file. You will copy from it all session.',
  );
  add('prompt-plan', 'prompt', { title: 'Plan the website', tool: 'ChatGPT', prompt: text(
    'I am a psychology student building a small WordPress website for a fictional service called [brief name]. Its audience is [audience] and the main action I want visitors to take is [action].',
    '',
    'Please give me:',
    '1. A sitemap with exactly six pages: Home, About, [Services / Workshops / Our research], Resources, FAQ and Contact.',
    '2. For each page: its purpose in one sentence and 3–4 sections it should contain.',
    '3. Three blog post titles for the Resources page, in two categories.',
    '4. Five frequently asked questions with short, careful answers.',
    '',
    'Rules: plain English for the public, warm but professional tone, no diagnosis, no promises of a cure, no requests for personal health information, and a note that the service is fictional.',
  ), expect: 'A six-page sitemap with a purpose and sections for each page, three post ideas in two categories and five FAQs. Check every claim yourself: the AI drafts, **you** decide what is accurate and ethical.' });
  add('visual-sitemap', 'image', { src: '/guides/psychology/sitemap.svg', alt: 'Home connects to the other pages of the site through the menu.', caption: 'Your sitemap works the same way as MindCare’s: the menu links Home to every other page.' });
  add('preview-wireframe', 'browser', { title: 'Example: a finished homepage (Bright Path)', url: 'brightpath-psychology.example', html: WIREFRAME, height: 'Tall', caption: 'One possible result. Yours will look different, but it should have the same parts: header and menu, a hero with one clear button, short sections and a footer with the disclaimer.' });
  add('quiz-plan', 'quiz', { question: 'Which plan is ready to build?', options: text(
    '*Six named pages, each with a purpose, one main visitor action and a content list',
    'A list of colours and fonts I like',
    'A ChatGPT answer pasted unchanged into WordPress',
    'A homepage only; the other pages can be decided later',
  ), explain: 'A build-ready plan says **what** pages exist, **why** each exists and **what** the visitor should do. Colours come later, and an AI answer always needs your review first.' });

  /* B — set up */
  task('task-setup', 'B. Start a new site and set it up properly', 10,
    '**Why this matters:** the settings you choose now (name, web addresses, comments) affect every page. Fixing them at the end breaks links.', '',
    '1. Open the **Capstone Playground** link below in a new tab. It starts a **new** site with Twenty Twenty-Five and the Contact Form 7 plugin. Your MindCare site is not affected.',
    '2. Store the site permanently in this browser straight away (as in Lab 01) and give it your brief’s name.',
    '3. **Settings → General:** set the **Site Title** to your brief name and write a short **Tagline** (for example, “Talking therapy for adults in a calm, private space”). Choose your **Timezone**. Click **Save Changes**.',
    '4. **Settings → Permalinks:** choose **Post name**, then **Save Changes**. Your addresses become readable, like `/about/` instead of `/?p=2`.',
    '5. **Settings → Discussion:** untick **Allow people to submit comments on new posts**, then save. A mental-health site should not host public comments it cannot moderate.',
    '6. **Clean up the samples:** move the “Hello world!” post and the “Sample Page” to the **Trash**.',
  );
  add('link-capstone', 'link', { title: 'Capstone Playground', url: CAPSTONE_PLAYGROUND_URL, description: 'A fresh WordPress site in your browser with Twenty Twenty-Five and Contact Form 7. Nothing to install, no account needed.', cta: 'Start my new site' });
  add('path-permalinks', 'clickpath', { title: 'Readable web addresses', steps: text('Dashboard', 'Settings', 'Permalinks', 'Post name', 'Save Changes') });
  stuck('stuck-capstone-launch', 'The new Playground does not start',
    '1. Open it in a normal Chrome or Edge window, not inside another app’s browser.',
    '2. Still failing? Open the **plain WordPress** link below, then install **Contact Form 7** yourself from **Plugins → Add New Plugin** and activate **Twenty Twenty-Five** in **Appearance → Themes**.',
    '3. Do not clear your browser data: it may hold your MindCare site from Labs 01–02.',
  );
  add('link-capstone-fallback', 'link', { title: 'Plain WordPress — startup fallback', url: PLAYGROUND_FALLBACK, description: 'Starts WordPress without the theme and plugin downloads. Add them yourself as described above.', cta: 'Open plain WordPress' });

  /* C — design */
  task('task-design', 'C. Give the site one consistent design', 15,
    '**Why this matters:** visitors judge whether a service is trustworthy within seconds. A calm, consistent design that is easy to read says “professional”.', '',
    '1. Open **Appearance → Editor → Styles** (the half-filled circle icon).',
    '2. Under **Browse styles**, try three style variations and pick the one that suits your audience. Calm, high-contrast and readable beats bright and busy.',
    '3. Open **Colors → Palette** and adjust at most two colours to match your brief. Keep body text dark on a light background.',
    '4. Open **Typography** and make sure the body text is a plain, readable font at a comfortable size.',
    '5. Open **Patterns → Header** (under Template parts). Add a **Site Logo** block next to the site title, upload a simple logo (a free icon or one made in Canva) and turn on **Use as Site Icon** in its settings, so the logo also appears in the browser tab.',
    '6. Click **Save**.',
  );
  add('path-styles', 'clickpath', { title: 'Global styles', steps: text('Dashboard', 'Appearance', 'Editor', 'Styles', 'Browse styles / Colors / Typography', 'Save') });
  add('quiz-design', 'quiz', { question: 'Why change colours and fonts in Styles rather than on each page?', options: text(
    '*Styles apply to the whole site at once, so every page stays consistent and one change updates everything',
    'Pages cannot have colours',
    'It makes the website load from ChatGPT',
    'Styles are only for the homepage',
  ), explain: 'Styles are site-wide design rules, like the clinic’s interior design. Set them once and every page follows; colouring pages one by one leads to an inconsistent site.' });

  /* D — pages */
  task('task-pages', 'D. Build the six pages with patterns', 25,
    '**Why this matters:** pages hold the lasting information on your site. Patterns are ready-made, well-designed layouts, so you can build a professional page without starting from an empty screen.', '',
    '1. Go to **Pages → Add New Page**. Create **Home, About, Services** (or your equivalent), **Resources, FAQ** and **Contact**. Publish each one, even if it is not finished yet.',
    '2. On **Home**, open the block inserter (**+**) → **Patterns**. Add a hero or banner pattern, a section with three columns and a call-to-action pattern. Replace every placeholder word and image with your own content.',
    '3. On **About** and **Services**, use your content list from Part A. Keep paragraphs short (2–4 sentences) and use headings so visitors can scan.',
    '4. On **FAQ**, add one **Details** block per question: the question is the summary and the answer is hidden until it is clicked. Use the five FAQs you reviewed.',
    '5. On **Contact**, write a short welcome sentence; you will add the form in Part H.',
    '6. At the bottom of **Home**, add the disclaimer: “This is a fictional service created for a university course. It is not medical advice. In an emergency, contact your local emergency number.”',
  );
  add('visual-editor', 'image', { src: '/guides/psychology/editor.jpg', alt: 'WordPress block editor with the toolbar at the top, content in the middle and settings on the right.', caption: 'The same editor as Lab 01: toolbar at the top, content in the middle, settings on the right. The + button opens Blocks and Patterns.' });
  add('prompt-page', 'prompt', { title: 'Draft a page from your plan', tool: 'ChatGPT', prompt: text(
    'Write the text for the [page name] page of [brief name], a fictional [type of service] for [audience].',
    'Use these sections: [paste the sections from your content list].',
    'Give each section a short heading and 2–3 sentences in plain, warm, professional English (reading age about 12).',
    'Do not diagnose, promise results or ask for personal health information. End with one clear button label that leads to [main action].',
  ), expect: 'Headings and short paragraphs that match your sections, plus one button label. Read every sentence: correct anything inaccurate and remove anything that sounds like a diagnosis or a promise.' });
  stuck('stuck-patterns', 'The pattern looks nothing like my brief',
    '- That is expected: patterns are layouts, not content. Keep the layout and replace every word and picture.',
    '- Delete blocks you do not need: select one and press **Delete**, or use the **⋮** menu → **Delete**.',
    '- Made a mess? Use **Ctrl/Cmd + Z** to undo, or open **⋮ → Revisions** to go back to an earlier version of the page.',
  );

  /* E — posts */
  task('task-posts', 'E. Write posts and sort them into categories', 10,
    '**Why this matters:** posts are dated articles that keep a site fresh. Categories help visitors find related articles, like labelled folders.', '',
    '1. Go to **Posts → Categories** and create the two categories from your plan (for example, *Coping skills* and *Understanding anxiety*).',
    '2. Go to **Posts → Add New Post**. Write at least **two** short posts (about 150 words each) from your post ideas.',
    '3. In the post settings on the right, choose a **Category**, add a short **Excerpt** (the summary shown in lists) and set a **Featured image**.',
    '4. End each post with a line such as “This article is general information, not a substitute for professional help.” Then **Publish**.',
  );
  add('quiz-page-post', 'quiz', { question: 'Your brief needs an article called “Five ways to sleep better before exams”. Where does it belong?', options: text(
    '*A post in a category, so it appears on the Resources page with a date',
    'A new page in the main menu',
    'The footer',
    'The site tagline',
  ), explain: 'Dated, article-style content is a **post**. Pages are for lasting information such as About or Contact. The Resources page will list your posts automatically in Part G.' });

  /* F — media */
  task('task-media', 'F. Add images responsibly', 10,
    '**Why this matters:** images make a site welcoming, but they must be legal to use and described for people who use screen readers.', '',
    '1. Use only free-to-use images (for example from Unsplash or Pexels) or images you made yourself. Avoid photos of real patients and pictures that stigmatise mental illness, such as a person holding their head in despair.',
    '2. Open **Media → Library** and upload your images there, so they are all in one place.',
    '3. For each image, write **Alternative Text** that describes what it shows and why it is there, for example “Two people talking calmly in a bright counselling room”. Leave it empty only for purely decorative images.',
    '4. Replace the placeholder images in your patterns with your own images from the Media Library.',
  );
  add('visual-alt', 'image', { src: '/guides/psychology/alt-text.png', alt: 'The Alternative Text field in the WordPress image settings.', caption: 'Write a description of your own image in Alternative Text; do not copy the screenshot’s example.' });

  /* G — homepage & menu */
  task('task-navigation', 'G. Set the homepage and build the menu', 10,
    '**Why this matters:** without a homepage setting, WordPress shows a list of posts first; without a menu, visitors cannot find your pages.', '',
    '1. **Settings → Reading:** under **Your homepage displays**, choose **A static page**. Set **Homepage** to *Home* and **Posts page** to *Resources*. Save.',
    '2. **Appearance → Editor → Navigation:** edit the menu so it shows About, Services, Resources, FAQ and Contact in that order. Remove any link to pages that no longer exist.',
    '3. **Appearance → Editor → Patterns → Footer:** add your disclaimer and a link to the Privacy Policy page (you will create it in Part H). Save.',
    '4. Click the site title in the header: it should take you back to Home. Click every menu link once.',
  );
  add('path-reading', 'clickpath', { title: 'Static homepage', steps: text('Dashboard', 'Settings', 'Reading', 'A static page', 'Homepage: Home · Posts page: Resources', 'Save Changes') });

  /* H — form & privacy */
  task('task-form', 'H. Add a contact form and a privacy page', 10,
    '**Why this matters:** a contact form turns a visitor into an enquiry. On a psychology site it must collect as little as possible and explain what happens to the data.', '',
    '1. Open **Contact → Contact Forms** (added by Contact Form 7) and edit **Contact form 1**. Keep only **name, email and message**. Do not ask for a diagnosis, medication or date of birth.',
    '2. Add a consent checkbox with this line in the form template: `[acceptance consent] I agree that my message is stored to answer my enquiry. [/acceptance]` Save the form and copy its **shortcode**.',
    '3. Edit your **Contact** page, add a **Shortcode** block and paste the shortcode. Add a sentence: “Please do not include health details in this form. If you are in crisis, contact your local emergency number.” Update the page.',
    '4. **Settings → Privacy:** create or select a **Privacy Policy** page, then edit it in plain English: what the form collects, why, who sees it and how long it is kept. Publish it.',
    '5. Test the form on the Contact page. Playground cannot send real email, so an error after pressing **Submit** is expected here; check that the fields and the consent box work. A real host (Lab 03) can send the messages.',
  );
  add('code-consent', 'code', { title: 'Contact Form 7 — form template', lang: 'text', code: text(
    '<label> Your name', '    [text* your-name autocomplete:name] </label>', '',
    '<label> Your email', '    [email* your-email autocomplete:email] </label>', '',
    '<label> Your message (please do not include health details)', '    [textarea* your-message] </label>', '',
    '[acceptance consent] I agree that my message is stored to answer my enquiry. [/acceptance]', '',
    '[submit "Send message"]',
  ) });
  add('quiz-form', 'quiz', { question: 'Which form field should a fictional therapy website NOT include?', options: text(
    '*“Describe your symptoms and current medication”',
    '“Your name”',
    '“Your email”',
    'A consent checkbox',
  ), explain: 'Health information is sensitive personal data. A public website form should collect only what is needed to reply; clinical details are discussed later through a secure, professional channel.' });

  /* I — quality */
  task('task-quality', 'I. Check quality: phone, accessibility and search', 10,
    '**Why this matters:** most visitors will open your site on a phone, some use screen readers or keyboards, and many will find it through a search engine.', '',
    '1. **Phone:** in the editor, use the **Preview** (device) button and choose **Mobile**. Check every page: text is readable, buttons are easy to tap and nothing is cut off.',
    '2. **Accessibility:** headings go in order (one H1 page title, then H2, then H3), every meaningful image has alt text, link text says where it goes (“Read our FAQ”, not “click here”) and text contrasts strongly with its background.',
    '3. **Search:** each page has a clear title and a short, readable web address (the **Slug** in the page settings). Each post has an excerpt.',
    '4. **Words:** read each page once aloud. Fix spelling, and remove any leftover placeholder text from patterns.',
    '5. Ask ChatGPT to review one page using the prompt below, then fix what you agree with.',
  );
  add('prompt-review', 'prompt', { title: 'Get a second opinion on one page', tool: 'ChatGPT', prompt: text(
    'Here is the text of the [page name] page of a fictional psychology website for [audience]:',
    '[paste the page text]',
    '',
    'Review it as a careful editor. List up to five improvements for: clarity for the public, accessibility (headings, link text), ethical language about mental health (no diagnosis, no promises, no stigma) and a clear next step for the visitor. Do not rewrite the whole page.',
  ), expect: 'A short list of specific suggestions. Apply the ones that are accurate; you remain responsible for the content.' });
  add('checkpoint-site', 'checkpoint', { body: '**You should now see:** your site title and logo in the header; a menu to About, Services, Resources, FAQ and Contact; a homepage built from patterns with one clear button; at least two posts on Resources; a FAQ that opens and closes; a contact form with a consent box; a Privacy Policy linked in the footer; and the fictional-service disclaimer.' });

  /* Z — back up & hand in */
  task('task-handin', 'Z. Back up the site and hand it in', 5,
    '**Why this matters:** Playground lives in your browser. Without a backup, a cleared browser means a lost website, and your instructor needs evidence of your work.', '',
    '1. Use the Playground **Export → Download as .zip** (as in Lab 01). Rename the file `yourname-capstone.zip`.',
    '2. Also export the content: **Tools → Export → All content → Download Export File**. This XML is what you would import into a real host in Lab 03.',
    '3. Take three screenshots: the homepage on desktop, the homepage on mobile and the Contact page.',
    '4. Submit the ZIP and the screenshots through the channel your instructor gives you. Never submit a password.',
  );
  add('visual-backup', 'image', { src: '/guides/psychology/backup.svg', alt: 'Save the page, store the Playground, export a ZIP, then restore and check the copy.', caption: 'Same four actions as Lab 01: save, store, export, and check that the copy restores.' });

  /* bonus */
  task('task-bonus-editor', 'Bonus — Invite a colleague as an Editor', 5,
    'Real sites are run by teams. Go to **Users → Add New User**, create a fictional colleague with the **Editor** role (untick “Send the new user an email”) and note what an Editor can and cannot do compared with an Administrator. Give people the lowest role they need.',
  );
  task('task-bonus-live', 'Bonus — Make it live', 5,
    'If your instructor provides hosting, follow **Lab 03** with this new site instead of MindCare: import the XML, re-upload the images and test the public address while signed out.',
  );

  add('quiz-final', 'quiz', { question: 'Which list puts building a website from A to Z in the right order?', options: text(
    '*Plan → set up → design → pages and posts → menu and form → check quality → back up',
    'Design → back up → plan → write posts',
    'Write posts → plan → set permalinks at the end',
    'Install many plugins → choose a brief → design',
  ), explain: 'Plan first so every later step has a purpose, set up the settings before content so links stay stable, and back up last (and often) so your work is safe.' });
  add('checkin', 'checkin', {});
  return steps;
}

export function psychologyTechnologyLab04(): Flow {
  const steps = capstoneSteps();
  const nodes: Flow['nodes'] = steps.map((st, i) => ({ id: st.id, type: st.type, x: 100 + (i % 2) * 60, y: 100 + i * 145, data: st.data }));
  const edges: Flow['edges'] = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
  const clean = sanitizeFlow({ nodes, edges }, 'lab');
  if (!clean.ok) throw new Error(clean.error);
  return clean.value;
}
