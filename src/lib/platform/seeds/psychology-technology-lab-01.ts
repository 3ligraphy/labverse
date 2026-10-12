import { sanitizeFlow, type Flow, type LabNodeType } from '../core.ts';
import { EDIT_SANDBOX_STARTER, HERO_SANDBOX_STARTER, HOMEPAGE_PREVIEW, PROCESS_PREVIEW, SECTION_SANDBOX_STARTER } from './psychology-site-previews.ts';
import { addPsychologyVisuals } from './psychology-visuals.ts';
import { addPlaygroundRecovery } from '../playground.ts';

const text = (...lines: string[]) => lines.join('\n');

/** WordPress Playground with Twenty Twenty-Five and the Blocks Animation plugin, opened on the Dashboard (no account, no install). */
export const PLAYGROUND_URL = 'https://playground.wordpress.net/?theme=twentytwentyfive&plugin=blocks-animation&url=/wp-admin/&page-title=MindCare%20Clinic';

/** Optional tasks start with this word; they are not counted in a session's core time. */
export const BONUS = 'Bonus —';

type Step = { id: string; type: LabNodeType; data: Record<string, string> };

/** Steps in reading order → a lab flow (a chain, laid out top to bottom). */
function chain(steps: Step[]): Flow {
  const nodes: Flow['nodes'] = steps.map((st, i) => ({ id: st.id, type: st.type, x: 100 + (i % 2) * 60, y: 100 + i * 145, data: st.data }));
  const edges: Flow['edges'] = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
  const clean = sanitizeFlow({ nodes, edges }, 'lab');
  if (!clean.ok) throw new Error(clean.error);
  return addPlaygroundRecovery(addPsychologyVisuals(clean.value));
}

/**
 * Technology for Psychology — the WordPress bootcamp, one lab per ~2-hour session (Lab 01 = Session 1, Lab 02 =
 * Session 2, a week apart). Psychology students with no technology or coding background build an informative,
 * animated website for a fictional psychology clinic in WordPress (Playground, zero install) with help from
 * ChatGPT. Every task is numbered one-action-per-line, with "Why this matters", "Stuck?" help and understanding
 * checks along the way. Each lab has its own progress, attendance session and check-in.
 */
function bootcampSteps(): Step[] {
  const steps: Step[] = [];
  const add = (id: string, type: LabNodeType, data: Record<string, string>) => { steps.push({ id, type, data }); };
  const stuck = (id: string, title: string, ...lines: string[]) => add(id, 'callout', { tone: 'WARNING', body: text(`**Stuck? ${title}**`, '', ...lines) });

  /* ======================================================== SESSION 1 */
  add('part-s1', 'part', { title: 'Session 1 — Plan, set up and build the pages', time: '2 hours' });

  add('task-orientation', 'task', { title: 'Before you start: websites, browsers and a CMS', time: '10 min', body: text(
    '**Why this matters:** you do not need to code to build a professional website, but knowing a few words makes every later step easier.', '',
    '**Four ideas in plain words**', '',
    '- A **website** is a set of pages that anyone can open on the internet — like a leaflet about the clinic that never runs out.',
    '- A **browser** is the program you use to open websites: Chrome, Edge, Firefox or Safari.',
    '- A **web address** (URL) is where a page lives, for example `mindcare-clinic.example/services`. You type it in the **address bar** at the very top of the browser.',
    '- A **CMS (content management system)** lets you build and update a website by filling in forms and arranging blocks, without writing code.', '',
    '**A psychology analogy:** think of the CMS as a clinic’s **filing system**. **Pages** are the permanent rooms of the clinic (reception, therapy rooms, contact desk). **Posts** are dated case notes or the monthly newsletter. **Categories** are the labelled folders those notes go into. The **theme** is the interior design: change it, and every room looks different but nothing inside is lost.', '',
    '**The two tools in this lab**', '',
    '- **WordPress** — the CMS. More websites run on WordPress than on any other system. We run it inside your browser, free, with nothing to install.',
    '- **ChatGPT** — an AI assistant. It helps you plan, draft text and write small pieces of design code. **You** check and decide; it assists.', '',
    '**What to do now**', '',
    '1. Read the glossary and the keyboard callout below (keep this page open — you can come back to them any time).',
    '2. Scroll through the preview of the finished website.',
    '3. Click the **phone** and **tablet** buttons above the preview to see the same site on smaller screens.',
    '4. Answer the two quick checks.',
  ) });
  add('text-glossary', 'text', { body: text(
    '### Glossary — the words you will meet', '',
    '| Word | What it means |', '| --- | --- |',
    '| **Dashboard** | The control room of your WordPress site: the first screen after you log in, with the menu on the left. |',
    '| **Block** | One piece of content on a page: a paragraph, a heading, an image, a button. Pages are built by stacking blocks. |',
    '| **Pattern** | A ready-made group of blocks (for example three service cards) that you insert and then edit. |',
    '| **Page** | A permanent part of the site that rarely changes, like *About* or *Contact*. |',
    '| **Post** | A dated article, like a newsletter item. The newest appears first. |',
    '| **Category** | A labelled folder that groups posts, like *Conditions* or *Resources*. |',
    '| **Tag** | A small optional label on a post, like *sleep* or *students*. |',
    '| **Menu** | The row of links at the top of every page that visitors use to move around. |',
    '| **Theme** | The design of the whole site: layout, colours, fonts. |',
    '| **Plugin** | An add-on that gives WordPress a new feature, like animations. |',
    '| **Media Library** | The storage room for every image and file you upload. |',
    '| **Draft** | Saved, but private: only people who can edit the site can see it. |',
    '| **Publish** | Make it public: anyone visiting the site can see it. |',
    '| **HTML** | The words and structure of a web page (“this is a heading, this is a button”). |',
    '| **CSS** | The look of a web page: colours, sizes, spacing and animation. |',
  ) });
  add('call-keyboard', 'callout', { tone: 'TIP', body: text(
    '**Keyboard basics** (Windows: **Ctrl** · Mac: **Cmd ⌘**)', '',
    '| Shortcut | Does |', '| --- | --- |',
    '| **Ctrl/Cmd + C** | Copy the selected text |', '| **Ctrl/Cmd + V** | Paste it |', '| **Ctrl/Cmd + A** | Select everything in the box you are in |',
    '| **Ctrl/Cmd + Z** | Undo the last change (press again to undo more) |', '| **Ctrl/Cmd + S** | Save — in the WordPress editor it saves your draft |',
    '| **Ctrl/Cmd + T** | Open a new browser tab |', '| **Ctrl/Cmd + click** a link | Open the link in a new tab, keeping this page open |',
    '| **Alt + Tab** (Mac: **Cmd + Tab**) | Switch between open windows |', '',
    '**Right-click** (two-finger click on a Mac trackpad) opens a small menu with *Copy*, *Paste* and *Open link in new tab*. Keep **this lab** in one tab and **WordPress** and **ChatGPT** in their own tabs.',
  ) });
  add('browser-target', 'browser', {
    title: 'Your target: the finished homepage', url: 'mindcare-clinic.example', html: HOMEPAGE_PREVIEW, height: 'Tall',
    caption: 'Fictional clinic for teaching. Notice the gentle motion: text rises in, soft colour blobs float, numbers count up.',
  });
  add('quiz-theme', 'quiz', {
    question: 'The clinic switches to a new theme. What happens to the text on the About page?',
    options: text('*It stays the same — only the design (layout, colours, fonts) changes', 'It is deleted and must be typed again', 'It is translated automatically', 'It moves into a post'),
    explain: 'A CMS keeps **content** and **design** apart, like moving the same files into a newly decorated room. That is why non-programmers can redesign a site safely.',
  });
  add('quiz-address', 'quiz', {
    question: 'A patient’s relative wants to visit the clinic’s Services page directly. What do they type into the browser’s address bar?',
    options: text('*The web address, e.g. mindcare-clinic.example/services', 'The word “Services” into the Dashboard', 'The clinic’s phone number', 'The name of the theme'),
    explain: 'Every page has its own **web address (URL)**. Typing it in the address bar opens that page; menus simply save visitors from typing.',
  });

  add('task-plan', 'task', { title: 'Plan the site with ChatGPT', time: '15 min', body: text(
    '**Why this matters:** a clear plan saves you from building pages nobody needs — just as a treatment plan comes before sessions.', '',
    '1. Open the **ChatGPT** card below. It opens in a new tab.',
    '2. Sign in (or ask your neighbour to share their screen and work as a pair).',
    '3. In the prompt card below, click **Copy**.',
    '4. Go to the ChatGPT tab and click in the message box at the bottom (*Ask anything*).',
    '5. Paste with **Ctrl/Cmd + V**.',
    '6. Replace every part in **[square brackets]** with your own choice — for example your clinic’s name and city. Delete the brackets themselves.',
    '7. Press **Enter** to send.',
    '8. Read the answer. Cross out anything that diagnoses, promises a cure or sounds like an advert.',
    '9. Open a notes document (Word, Google Docs or Notes) and paste the final sitemap into it. Name it *Website notes*. You will reuse it in every task.',
  ) });
  add('link-chatgpt', 'link', { title: 'ChatGPT', url: 'https://chatgpt.com/', description: 'Your writing and coding assistant for this bootcamp. A free account is enough.', cta: 'Open ChatGPT' });
  add('prompt-plan', 'prompt', {
    title: 'Site plan and sitemap', tool: 'ChatGPT',
    prompt: text(
      'You are a web content strategist who works with healthcare and mental-health organisations.',
      'Help me plan a purely informational website for a fictional psychology clinic called [MindCare Psychology Clinic] in [Cairo, Egypt].',
      'Audience: [adults and university students who are thinking about seeing a psychologist for the first time, and their families].',
      'Tone: warm, calm, hopeful, plain English (reading age about 12), never alarming, never salesy.',
      '',
      'Give me:',
      '1. A one-sentence purpose statement for the website.',
      '2. A sitemap with these pages: Home, About, Services, Conditions, Team, Resources, Contact. For each page list 3–5 sections in order.',
      '3. Which content should be PAGES (static) and which should be POSTS (dated, grouped in categories) in WordPress, with one sentence explaining why.',
      '4. Three things this website must NOT do (for example: diagnose, promise cures, collect health data).',
      '',
      'Format the sitemap as a table. Keep the whole answer under 300 words.',
    ),
    expect: 'A short purpose statement, a 7-page sitemap table, a clear pages vs posts split (condition articles and resources as **posts**, the rest as **pages**), and ethical limits such as “no diagnosis” and “no collection of personal health data”.',
  });
  stuck('stuck-chatgpt', 'ChatGPT’s answer is too long or off-topic',
    '1. Do not start again — reply in the same chat. ChatGPT remembers the conversation.',
    '2. Say exactly what to fix, for example: *“Shorter please: maximum 150 words, as a table only.”*',
    '3. Off-topic? Remind it: *“Stay on the website plan for a psychology clinic. Only the sitemap, please.”*',
    '4. Still wrong? Click **New chat** (top left), paste the prompt again and check every bracket was replaced.',
  );
  add('call-ai-responsible', 'callout', { tone: 'IMPORTANT', body: text(
    '**Using AI responsibly in mental-health content**', '',
    '- ChatGPT can sound confident and still be wrong. **Check every health fact** against a trusted source (WHO, NHS, APA) and link to it.',
    '- Never type real patient information, real names or case details into an AI tool.',
    '- The website informs; it never diagnoses, labels or promises results.',
    '- You are the author. Edit the AI’s words so they are accurate, kind and yours.',
  ) });
  add('quiz-ai-trust', 'quiz', {
    question: 'ChatGPT writes: “Anxiety affects exactly 1 in 3 people in Egypt.” What should you do before using this sentence?',
    options: text('*Find the figure in a trusted source (e.g. WHO); if you cannot, delete it', 'Use it — ChatGPT is always accurate with numbers', 'Use it but make the font smaller', 'Ask ChatGPT “are you sure?” and use it if it says yes'),
    explain: 'AI tools can invent precise-sounding numbers. On a health website, a statistic without a checkable source is removed. Asking the AI to confirm itself is **not** checking.',
  });

  add('task-brand', 'task', { title: 'Choose a calm brand: colours and fonts', time: '8 min', body: text(
    '**Why this matters:** colour and type set the emotional tone before anyone reads a word — a calm room helps clients feel safe.', '',
    '1. Copy the brand prompt below.', '2. Paste it into the **same** ChatGPT chat and replace the brackets.', '3. Send it.',
    '4. Copy the 5 colour codes (they look like `#0F5C6B`) into your *Website notes*.', '5. Write down the two font names next to them.',
    '6. Check the answer confirms the text passes the contrast check (at least **4.5 : 1**, so people with low vision can read it).',
  ) });
  add('prompt-brand', 'prompt', {
    title: 'Brand colours and fonts', tool: 'ChatGPT',
    prompt: text(
      'Suggest a brand palette and font pairing for a psychology clinic website called [MindCare Psychology Clinic].',
      'Mood: [calm, safe, hopeful, professional]. Avoid harsh reds and pure black on pure white.',
      '',
      'Give me:',
      '- 5 colours with hex codes and a role for each: background, text, primary (buttons/links), secondary, accent.',
      '- Confirm that the text colour on the background and white text on the primary colour both pass WCAG AA contrast (4.5:1). If one fails, fix it.',
      '- One heading font and one body font, both free on Google Fonts, and why they suit a mental-health brand.',
      '- A one-line description of the visual style I can reuse when I ask for images.',
    ),
    expect: 'Five hex codes with roles (e.g. cream background, deep teal text/primary, sage secondary, soft lavender, warm coral accent), a contrast confirmation, and a serif + sans-serif pairing such as Fraunces + Inter.',
  });

  add('task-launch', 'task', { title: 'Launch WordPress in your browser', time: '10 min', body: text(
    '**Why this matters:** WordPress Playground gives every student a real WordPress site in seconds — no account, no installation, no cost.', '',
    '1. Use Chrome, Edge or Firefox in a **normal** window (not private/incognito).',
    '2. Click **Launch WordPress** on the card below. A new tab opens.',
    '3. Wait. The first start downloads WordPress into your browser and can take up to a minute.',
    '4. When it finishes you are already **logged in as the administrator** (the person with full control).',
    '5. Look at the two areas on screen:', '   - the **dark column on the left** — the WordPress **admin menu**;', '   - Playground’s **Dock**, usually floating near the bottom, with its own tools such as **Export**.',
    '6. The link has already installed the **Twenty Twenty-Five** theme and the **Blocks Animation** plugin for you.',
  ) });
  add('link-playground', 'link', {
    title: 'WordPress Playground — MindCare starter', url: PLAYGROUND_URL,
    description: 'Full WordPress in your browser with Twenty Twenty-Five and the Blocks Animation plugin preloaded. You are logged in as admin.', cta: 'Launch WordPress',
  });
  add('call-save-early', 'callout', { tone: 'CAUTION', body: 'Playground lives in **this browser on this laptop**. Before you leave today you will **store it permanently** and **download a .zip backup** (task 1.11). Do not close the Playground tab until then.' });
  add('check-launch', 'checkpoint', { body: 'You should see the WordPress **Dashboard**, and the admin menu on the left lists **Posts, Media, Pages, Comments, Appearance, Plugins, Users, Tools, Settings**.' });
  stuck('stuck-launch', 'Playground will not load',
    '1. Wait a full minute — the first load is slow on shared Wi-Fi.',
    '2. Still blank? Press **F5** (Mac: **Cmd + R**) to reload. You have not built anything yet, so nothing is lost.',
    '3. Check you are not in a private/incognito window.', '4. Try another browser (Chrome or Edge work best).',
  );

  add('task-identity', 'task', { title: 'Tour the Dashboard and name your site', time: '10 min', body: text(
    '**Why this matters:** the site title appears on every page and in Google results — it is the clinic’s sign above the door.', '',
    '**Tour (hover, do not click yet)**', '',
    '| Menu item | What lives there | Clinic analogy |', '| --- | --- | --- |',
    '| **Posts** | Dated articles + categories and tags | Newsletter archive |', '| **Media** | Every image and file | Photo cabinet |',
    '| **Pages** | Permanent pages | The rooms of the clinic |', '| **Appearance › Editor** | Header, footer, styles, menu | Interior design |',
    '| **Plugins** | Add-on features | New equipment |', '| **Users** | Who can log in and what they may do | Staff keys |', '| **Settings** | Site name, homepage | Front-desk rules |', '',
    '**Name the site**', '',
    '1. In the left menu, hover over **Settings** and click **General**.',
    '2. Click in the **Site Title** box.', '3. Press **Ctrl/Cmd + A**, then type your clinic’s name, e.g. *MindCare Psychology Clinic*.',
    '4. Click in the **Tagline** box and type one short line, e.g. *Evidence-based psychological care in Cairo*.',
    '5. Scroll to the bottom and click the blue **Save Changes** button.',
  ) });
  add('path-general', 'clickpath', { title: 'Site title and tagline', steps: text('Dashboard', 'Settings', 'General', 'Site Title + Tagline', 'Save Changes') });
  add('check-identity', 'checkpoint', { body: 'At the top of the screen you should see “**Settings saved.**”, and your clinic name now appears at the top left of the dark admin bar.' });
  add('quiz-where-title', 'quiz', {
    question: 'Your clinic changes its name next year. Where do you update the name shown on every page?',
    options: text('*Settings › General › Site Title', 'Pages › About', 'Media › Library', 'Plugins › Add New Plugin'),
    explain: 'The **Site Title** is a single setting used everywhere (header, browser tab, search results). Change it once, the whole site updates.',
  });

  add('task-pages-posts', 'task', { title: 'Pages vs posts — the key CMS idea', time: '7 min', body: text(
    '**Why this matters:** choosing correctly keeps the site tidy as it grows — new articles appear in the right place without touching the menu.', '',
    '| | **Page** | **Post** |', '| --- | --- | --- |',
    '| Like… | A permanent room of the clinic | A dated newsletter item or case note in a folder |',
    '| Used for | Content that rarely changes | News, articles, updates |', '| Date matters? | No | Yes — newest first |',
    '| Organised by | The menu | **Categories** (folders) and **tags** (labels) |',
    '| MindCare examples | Home, About, Services, Team, Contact | “Understanding anxiety”, “5 tips for exam stress” |', '',
    '1. Read the table.', '2. Answer the two quick checks below before moving on.',
  ) });
  add('quiz-workshop', 'quiz', {
    question: 'The clinic wants to announce a new stress-management workshop happening next month. Page or post?',
    options: text('*A post — it is dated news that will become old', 'A page — add it to the main menu', 'A new theme', 'A plugin'),
    explain: 'Announcements are **posts**: they carry a date, appear newest first and slide down the list as time passes, without cluttering the menu.',
  });
  add('quiz-hours', 'quiz', {
    question: 'Where should the clinic’s address and opening hours live?',
    options: text('*On the Contact page — permanent information', 'In a new post every week', 'In the Media Library', 'In a tag called “hours”'),
    explain: 'Information that stays true for a long time belongs on a **page**. Visitors expect to find it in the menu under *Contact*.',
  });

  add('task-about-together', 'task', { title: 'Build your first page together: About', time: '15 min', body: text(
    '**Why this matters:** every page is built the same way — learn it once on *About* and you can build any page.', '',
    'Follow along with your instructor:', '',
    '1. In the left menu, hover over **Pages** and click **Add New Page**.',
    '2. A welcome guide may pop up. Click the **×** to close it.',
    '3. Click where it says **Add title** and type `About`.',
    '4. Press **Enter**. The cursor moves into the first empty block, ready for text.',
    '5. Find the blue square **+** button at the **top left** of the editor (it is called the *Block Inserter*). Click it.',
    '6. A panel opens. Click the **Patterns** tab.', '7. Click a category such as *Text* or *About*.',
    '8. Click one pattern you like. It is inserted into your page.', '9. Click the **×** at the top of the panel to close it.',
    '10. Copy the page-copy prompt below into ChatGPT, replace the brackets with `About`, and send it.',
    '11. In the page, click on a heading of the pattern, select its text with **Ctrl/Cmd + A**, and paste or type your heading.',
    '12. Do the same for each paragraph of the pattern.',
    '13. Press **Ctrl/Cmd + S** to save a draft. You should see *Saved* near the top right.',
    '14. Click the blue **Publish** button (top right), then **Publish** again in the panel that opens.',
    '15. Click **View Page** to see it as a visitor would.',
  ) });
  add('path-new-page', 'clickpath', { title: 'Add a page', steps: text('Dashboard', 'Pages', 'Add New Page', 'Add title', '+ Block Inserter', 'Patterns', 'Publish') });
  add('prompt-page-copy', 'prompt', {
    title: 'Page copy (About, Home, Contact…)', tool: 'ChatGPT',
    prompt: text(
      'Write website copy for the [About] page of [MindCare Psychology Clinic], a fictional psychology clinic in [Cairo].',
      'Use this section list: [paste the sections ChatGPT suggested for this page in the site plan].',
      '',
      'Rules:',
      '- Warm, calm, plain English. Short paragraphs (2–3 sentences). Use "you" and "we".',
      '- Explain what clinical psychology is in 2–3 sentences, accurately, without jargon.',
      '- Never diagnose, never promise a cure or a result, no invented statistics, awards or reviews.',
      '- Include a heading for each section and suggest one button label.',
      '- Total length: about [200] words.',
      '',
      'After the copy, list any facts I should double-check with a reliable source.',
    ),
    expect: 'Headed sections with short, kind paragraphs; an accurate definition (clinical psychology applies psychological science to understand, assess and treat mental-health difficulties); no promises or fake numbers; and a short list of facts to verify.',
  });
  stuck('stuck-inserter', 'I can’t find the + (Block Inserter)',
    '1. Look at the **top left** corner of the editor, next to the WordPress logo: a square **+** button.',
    '2. Window too narrow? Make the browser window full screen — some buttons hide on small windows.',
    '3. Alternative: click in an empty line of the page and type **/** (slash), then a block name such as `/heading` or `/image`, and press **Enter**.',
    '4. Inserted the wrong thing? Press **Ctrl/Cmd + Z** to undo.',
  );
  add('check-about', 'checkpoint', { body: 'You should see your **About** page in the browser as a visitor: your heading, your paragraphs, and the pattern’s layout. In **Pages › All Pages**, *About* is listed **without** “— Draft” after it.' });

  add('task-pages-alone', 'task', { title: 'Your turn: build the other pages', time: '20 min', body: text(
    '**Why this matters:** repeating a skill without help is how it sticks. Use task 1.7 only if you get stuck.', '',
    'Create these pages **on your own**: **Home, Services, Conditions, Team, Resources, Contact**.', '',
    '1. For each page: add the title, insert one pattern, replace the sample text (ChatGPT can help), then **Publish**.',
    '2. One good section per page is enough today — you will add more in Session 2.',
    '3. **Contact:** type a fictional address, opening hours, an email such as `hello@mindcare.example`, and “In an emergency call 123 (ambulance)”. No form is needed.',
    '4. **Resources** and **Conditions** can stay short (one sentence) — posts will fill them later.',
    '5. When all six are done, open **Pages › All Pages** and check the list.',
  ) });
  stuck('stuck-draft', 'My page doesn’t show on the site (published vs draft)',
    '1. Open **Pages › All Pages**. A page with **— Draft** after its title is saved but **private**.',
    '2. Click its title to open it, then click the blue **Publish** button (top right) and **Publish** again to confirm.',
    '3. After publishing, the button says **Save** (or **Update**) — use it whenever you change a published page.',
    '4. Still not visible? Reload the visitor tab (**F5** / **Cmd + R**).',
  );
  add('quiz-draft', 'quiz', {
    question: 'You saved the Team page as a draft. Who can see it on the website?',
    options: text('*Only logged-in users who can edit pages', 'Everyone on the internet', 'Only people who know the link', 'Nobody — drafts are not saved'),
    explain: 'Drafts are saved but stay private until you click **Publish** — like notes in a supervisor’s review tray before they go in the file.',
  });
  add('check-pages', 'checkpoint', { body: 'Success: **Pages › All Pages** lists **Home, About, Services, Conditions, Team, Resources and Contact**, none marked “— Draft”. (A “Sample Page” may also be there — you can hover over it and click **Trash**.)' });

  add('task-homepage', 'task', { title: 'Choose your homepage and posts page', time: '5 min', body: text(
    '**Why this matters:** WordPress normally shows the latest posts first — a clinic needs a designed welcome page instead.', '',
    '1. In the left menu, hover over **Settings** and click **Reading**.',
    '2. Next to **Your homepage displays**, click **A static page**.',
    '3. In the **Homepage** list, choose **Home**.', '4. In the **Posts page** list, choose **Resources**.',
    '5. Click **Save Changes** at the bottom.',
    '6. Hover over your clinic name at the top left of the dark admin bar and click **Visit Site**.',
  ) });
  add('path-reading', 'clickpath', { title: 'Static homepage', steps: text('Dashboard', 'Settings', 'Reading', 'Your homepage displays: A static page', 'Homepage: Home · Posts page: Resources', 'Save Changes') });
  add('check-homepage', 'checkpoint', { body: 'You should see your **Home** page when you visit the site, not a list of posts.' });

  add('task-menu', 'task', { title: 'Build the navigation menu', time: '12 min', body: text(
    '**Why this matters:** the menu is the clinic’s signposting — visitors who cannot find a page leave.', '',
    'In Twenty Twenty-Five the menu is a **Navigation block** in the header. You edit it in the **Site Editor** (the design area).', '',
    '1. In the left menu, hover over **Appearance** and click **Editor**.',
    '2. In the dark sidebar on the left, click **Navigation**.',
    '3. Click your menu (often called *Navigation* or *Header navigation*).',
    '4. To add a page: click **+**, choose **Page link**, and pick the page.',
    '5. To reorder: drag an item up or down (or use the arrows).',
    '6. To remove one: click the **⋮** (three dots) next to it and choose **Remove**.',
    '7. Aim for: **About · Services · Conditions · Team · Resources · Contact** (your site name already links to Home).',
    '8. Click **Save** (top right). If asked, click **Save** again.',
    '9. Visit the site and click every link. Then make the browser window narrow and test the menu button.',
  ) });
  add('path-navigation', 'clickpath', { title: 'Edit the menu', steps: text('Dashboard', 'Appearance', 'Editor', 'Navigation', 'Your menu', '+ Page link / drag to reorder', 'Save') });
  stuck('stuck-menu', 'My menu is not showing (or shows the wrong pages)',
    '1. Only **published** pages can appear in the menu. Check **Pages › All Pages** for “— Draft”.',
    '2. Did you click **Save** in the Site Editor? Reopen **Appearance › Editor › Navigation** and check.',
    '3. The menu shows *all* pages in random order? That is WordPress’s automatic list. Edit it once (step 4–6) and it becomes your own menu.',
    '4. On a narrow window the links hide behind a **menu button** (three lines). Click it.',
  );
  add('quiz-menu', 'quiz', {
    question: 'You published a new page called “FAQ”, but it is not in your custom menu. Why?',
    options: text('*A custom menu only shows the links you add — add a Page link to FAQ', 'The page is broken and must be deleted', 'Pages can never be in menus', 'You must install a plugin first'),
    explain: 'Once you edit the menu, **you** choose its links. New pages are not added automatically — like adding a new room to the clinic’s signpost by hand.',
  });
  add('check-menu', 'checkpoint', { body: 'Success: the header shows your clinic name and six menu links. Every link opens the right page, and on a narrow window the links collapse into a menu button.' });

  add('task-save1', 'task', { title: 'Save your site before you leave', time: '8 min', body: text(
    '**Why this matters:** this is the most important task today. Without it, your site can be gone next week.', '',
    '**A. Store it permanently in this browser**', '',
    '1. Look at the Playground **Dock** (the bar at the very top). Next to the address field you see a status: **Autosaved** or **Unsaved**.',
    '2. Click that status.', '3. In the **Store permanently** pane, choose to keep it in this browser.',
    '4. If asked for a name, type `MindCare – [your name]`.', '5. Check the status now says **Saved**.', '',
    '**B. Download a backup .zip** (a single file that contains your whole site)', '',
    '1. In the Dock, click **Export**.', '2. Click **Download as .zip**.', '3. Find the file in your **Downloads** folder.',
    '4. Rename it `mindcare-session1.zip`.', '5. Upload it to your OneDrive/Google Drive, or email it to yourself.',
  ) });
  add('path-export', 'clickpath', { title: 'Back up the site', steps: text('Playground Dock', 'Export', 'Download as .zip') });
  stuck('stuck-lost', 'I closed the tab / my site is gone',
    '1. Open playground.wordpress.net in the **same browser** and click **Playgrounds** in the Dock. A stored or autosaved site is listed there.',
    '2. Not listed? If you downloaded a .zip, click **New › Import zip** and choose it (Lab 02, task 1.1 shows how).',
    '3. No save and no zip? The work is lost — browser storage is wiped by private windows, clearing history or shared lab PCs. Start again with your *Website notes* and ChatGPT chat: rebuilding is much faster the second time.',
  );
  add('quiz-backup', 'quiz', {
    question: 'Which backup is safest if you use a different lab computer next week?',
    options: text('*The .zip file saved in your cloud drive or email', 'The site stored in this browser', 'A screenshot of the homepage', 'Remembering the web address'),
    explain: 'Browser storage stays on **this** laptop. The **.zip** contains everything and can be imported on any computer with **New › Import zip**.',
  });
  add('check-s1', 'checkpoint', { body: 'Success for Session 1: the Dock shows **Saved**, `mindcare-session1.zip` is in your cloud drive or email, and your site has a title, 7 published pages, a static homepage and a working menu. That is a real CMS website — well done.' });

  add('task-bonus-s1', 'task', { title: `${BONUS} Polish the Home page`, time: '10 min', body: text(
    '*Optional — only if you finished everything above.*', '',
    '1. Open **Home** and add one more pattern, e.g. a call-to-action with a button.',
    '2. Ask ChatGPT for a 2-sentence welcome using the page-copy prompt.',
    '3. Make the button link to your Services page: select the button, click the **link** icon, type `Services`, choose the page.',
    '4. Click **Save**, then download a new .zip (Dock › Export).',
  ) });

  /* ======================================================== SESSION 2 */
  add('part-s2', 'part', { title: 'Session 2 — Content with the CMS, design, animation and publish', time: '2 hours' });

  add('task-restore', 'task', { title: 'Restore your site', time: '5 min', body: text(
    '**Why this matters:** you will often move work between computers — restoring a backup is a core digital skill.', '',
    '**Same laptop and browser as last week?**', '1. Open the Playground card below.', '2. Click **Playgrounds** in the Dock.', '3. Click your *MindCare* site.', '',
    '**Different laptop, or the site is not there?**', '1. Download `mindcare-session1.zip` from your cloud drive or email.',
    '2. Open the Playground card below.', '3. In the Dock click **New**, then **Import zip**.', '4. Choose `mindcare-session1.zip`.',
    '5. Type `/wp-admin/` in the Dock’s address field and press **Enter** to reach the Dashboard.',
    '6. Store the site permanently again (click **Autosaved/Unsaved** in the Dock).',
  ) });
  add('link-playground-home', 'link', { title: 'WordPress Playground', url: 'https://playground.wordpress.net/', description: 'Open your saved site from Playgrounds, or import your .zip with New › Import zip.', cta: 'Open Playground' });
  add('path-import', 'clickpath', { title: 'Import your backup', steps: text('Playground Dock', 'New', 'Import zip', 'mindcare-session1.zip') });
  add('check-restore', 'checkpoint', { body: 'You should see your Dashboard, and **Pages › All Pages** lists the 7 pages you built last week.' });

  add('task-conditions', 'task', { title: 'Categories and your first condition post (together)', time: '15 min', body: text(
    '**Why this matters:** categories are the labelled folders of your filing system — every condition post files itself on the Conditions page.', '',
    '**Create two folders (categories)**', '',
    '1. Hover over **Posts** and click **Categories**.', '2. In **Name**, type `Conditions`. Click **Add New Category**.',
    '3. In **Name**, type `Resources`. Click **Add New Category**.', '',
    '**Write the first post: Anxiety**', '',
    '1. Hover over **Posts** and click **Add New Post**.', '2. Click **Add title** and type `Understanding anxiety`.',
    '3. Copy the condition prompt below into ChatGPT, keep `[anxiety]`, and send it.',
    '4. Paste ChatGPT’s answer into the post: click under the title and press **Ctrl/Cmd + V**. WordPress turns headings and lists into blocks automatically.',
    '5. Open each source ChatGPT lists and check it exists and says the same. Delete any line you cannot confirm.',
    '6. In the right sidebar, make sure the **Post** tab is selected. (No sidebar? Click the square **Settings** icon at the top right.)',
    '7. Open **Categories** and tick **Conditions**. Untick *Uncategorized*.', '8. Open **Tags**, type `anxiety` and press **Enter**.',
    '9. Click **Publish**, then **Publish** again.',
    '10. Open your **Conditions** page and add a **Query Loop** block (via **+**, search `Query Loop`). In its settings, filter it by the **Conditions** category — your condition posts now list themselves there. *(Simpler alternative: add a link to the Conditions category in the menu.)*',
  ) });
  add('path-categories', 'clickpath', { title: 'Categories and posts', steps: text('Dashboard', 'Posts', 'Categories', 'Add New Category', 'Posts', 'Add New Post', 'Post sidebar › Categories ☑ Conditions', 'Publish') });
  add('prompt-condition', 'prompt', {
    title: 'An accurate, kind condition article', tool: 'ChatGPT',
    prompt: text(
      'Write a short, informational blog post for a psychology clinic website about [anxiety].',
      'Audience: members of the public in [Egypt], first-time visitors, possibly worried. Reading age about 12.',
      '',
      'Structure with headings:',
      '1. What is [anxiety]? (everyday worry vs. when it becomes a difficulty)',
      '2. Common signs (bulleted, described as experiences, not a checklist for self-diagnosis)',
      '3. What can help (evidence-based options such as CBT, talking to a professional, self-care basics)',
      '4. When to seek help, and that a qualified professional is needed for any diagnosis',
      '5. Sources: 2–3 reputable organisations (e.g. WHO, NHS, APA) I can check',
      '',
      'Rules: 250–350 words. Hopeful and non-stigmatising language ("a person living with depression", not "a depressive"). No invented statistics, no promises of a cure, no medication advice. End with one sentence encouraging the reader to reach out.',
    ),
    expect: 'Five headed sections, gentle person-first language, no self-diagnosis checklist, a clear “only a qualified professional can diagnose” line, and real organisations you then **open and check yourself** before linking.',
  });
  add('call-accuracy', 'callout', { tone: 'IMPORTANT', body: 'Mental-health information affects real people. If ChatGPT invents a statistic or a link that does not exist, delete it. Never write “you have X if…”.' });
  add('quiz-category-tag', 'quiz', {
    question: 'Your post “Coping with exam stress” is about stress and is written for students. Which set-up is best?',
    options: text('*Category: Conditions (or Resources) · Tags: students, exams, stress', 'Category: students · Tags: Conditions', 'A new category for every post', 'No category — the menu will find it'),
    explain: 'Use a few broad **categories** (folders) as the main sections and **tags** (labels) for specific topics. One category per post keeps the filing system clear.',
  });

  add('task-condition-alone', 'task', { title: 'Your turn: add one more condition post yourself', time: '10 min', body: text(
    '**Why this matters:** this checks you can run the whole posting workflow without step-by-step help.', '',
    'Write a post about **depression** or **stress and burnout** — on your own. Use the same prompt (change the bracket) and the same steps as before.', '',
    'Your post is done when it meets every point of the checkpoint below.',
  ) });
  add('check-condition-alone', 'checkpoint', { body: text(
    'Success criteria:', '',
    '- Published (no “— Draft” in **Posts › All Posts**)', '- Category **Conditions** ticked; *Uncategorized* unticked; 1–3 tags',
    '- Headings for each section and a **Sources** section with links you opened and checked',
    '- Says only a qualified professional can diagnose; no cure promise; no invented numbers',
    '- It appears automatically on your **Conditions** page',
  ) });

  add('task-spot', 'task', { title: 'Spot the problem: critique a weak AI answer', time: '10 min', body: text(
    '**Why this matters:** using AI well means judging its output like a careful clinician reads a report — not copying it.', '',
    'A student asked an AI tool for a homepage section and pasted the answer below **without checking**. Your job:', '',
    '1. Read the answer below.', '2. In your *Website notes*, list every problem you can find (aim for **at least 5**). Use the checklist.',
    '3. For each problem, write one line on how to fix it.', '4. Answer the quick check.', '5. Compare with a neighbour: did they find one you missed?', '',
    '**Checklist:** accuracy & evidence · diagnosis or cure claims · invented numbers or reviews · stigmatising words · disclaimer & emergency info · privacy · accessibility (alt text, link text) · AI-image honesty',
  ) });
  add('text-weak-answer', 'text', { body: text(
    '> **AI answer (do not copy!)**', '>',
    '> ## Beat anxiety for good!', '>',
    '> Our revolutionary CBT program **cures anxiety in just 4 sessions — guaranteed.** 98% of our clients never feel anxious again!', '>',
    '> **Do you worry a lot? Then you have Generalized Anxiety Disorder.** Take our quiz below and send us your answers, your full name and your medical history so we can confirm your diagnosis.', '>',
    '> Don’t be one of those crazy people who wait too long.', '>',
    '> `<img src="happy-patient.jpg">` *(photo of our real client Sarah, created with AI)*', '>',
    '> For more info [click here](#).',
  ) });
  add('quiz-spot', 'quiz', {
    question: 'Which problem in this AI answer is the most serious for a mental-health website?',
    options: text('*It diagnoses readers and promises a guaranteed cure', 'The heading is too short', 'It uses the word “program”', 'It does not mention the clinic’s opening hours'),
    explain: 'Diagnosing from a website and guaranteeing cures can mislead and harm vulnerable people. Also wrong: the invented 98% figure, asking for names and medical history (privacy), the stigmatising word “crazy”, an image with no alt text presented as a real client although it is AI, the vague “click here” link, and no disclaimer or emergency information.',
  });
  add('check-spot', 'checkpoint', { body: text(
    'Success: your list includes at least 5 of these 8 problems, each with a fix:', '',
    '1. Cure guarantee → “CBT is an evidence-based therapy that helps many people manage anxiety.”',
    '2. Invented 98% statistic → remove, or cite a real source.', '3. Self-diagnosis (“then you have GAD”) → “Only a qualified professional can make a diagnosis.”',
    '4. Collecting names and medical history → never collect health data on the site.', '5. Stigmatising “crazy people” → kind, person-first language.',
    '6. Image with no **alt text** → add a description.', '7. AI image presented as a real client → label as AI, never as a real person.',
    '8. “Click here” link and no disclaimer/emergency info → descriptive link text + footer disclaimer.',
  ) });

  add('task-media', 'task', { title: 'Images, the Media Library and alt text', time: '10 min', body: text(
    '**Why this matters:** images set the mood, and alt text makes them accessible to people who use screen readers.', '',
    '1. Open **Openverse** or **Unsplash** (cards below) in a new tab.',
    '2. Search calm subjects: `calm nature`, `sunlight window`, `armchairs room`, `abstract pastel`. Avoid identifiable people looking distressed.',
    '3. Download 3 images. Note each creator’s name for the credit.',
    '4. Back in WordPress, hover over **Media** and click **Add New Media File**.', '5. Drag the images onto the upload area (or click **Select Files**).',
    '6. Click the first image. In **Alternative Text**, type a short description (the alt-text prompt can help).',
    '7. In **Caption**, type the credit, e.g. *Photo: [name] / Unsplash*, or *AI-generated illustration*.',
    '8. Repeat for each image.',
    '9. Open your **About** page, click **+**, add an **Image** block, choose **Media Library**, pick an image, click **Select**, then **Save**.',
  ) });
  add('link-openverse', 'link', { title: 'Openverse', url: 'https://openverse.org/', description: 'Search millions of openly licensed images. Check the licence and copy the attribution.', cta: 'Find images' });
  add('link-unsplash', 'link', { title: 'Unsplash', url: 'https://unsplash.com/', description: 'High-quality photos free to use under the Unsplash licence. Crediting the photographer is appreciated.', cta: 'Browse photos' });
  add('path-media', 'clickpath', { title: 'Upload images', steps: text('Dashboard', 'Media', 'Add New Media File', 'Select Files', 'Click image › Alternative Text + Caption') });
  add('prompt-alt', 'prompt', {
    title: 'Alt text that helps', tool: 'ChatGPT',
    prompt: text(
      'Write alt text for an image on a psychology clinic website. The image shows: [describe what you see, e.g. a bright, quiet room with two armchairs facing each other and a plant by the window].',
      'It is used on the [About] page next to the heading [“A calm space to talk”].',
      'Rules: under 125 characters, describe what matters for the page’s meaning, do not start with "image of", no keyword stuffing.',
      'Also tell me if the image is purely decorative (then the alt text should be empty).',
    ),
    expect: 'One clear sentence such as “Two armchairs facing each other in a bright, quiet counselling room” — or advice that a purely decorative shape should have empty alt text.',
  });
  add('prompt-image', 'prompt', {
    title: 'Optional: a calm AI illustration', tool: 'ChatGPT',
    prompt: text(
      'Create an image for the homepage hero of a psychology clinic website.',
      'Style: [soft, minimal flat illustration with gentle grain], colour palette [deep teal #0F5C6B, sage green #8FBFAE, soft lavender #D9D3F2, warm cream #FBF8F3, a touch of coral #E07A5F].',
      'Subject: [an abstract, peaceful scene — a winding path through soft hills towards a rising sun, symbolising growth and hope].',
      'No text, no logos, no faces, no medical equipment, nothing distressing. Wide landscape format (16:9) with calm empty space on the left for a heading.',
    ),
    expect: 'A soft, abstract landscape in your brand colours. Upload it like any image and caption it **“AI-generated illustration”**.',
  });
  add('quiz-alt', 'quiz', {
    question: 'What is alt text mainly for?',
    options: text('*Describing the image for people who use screen readers or cannot load images', 'Making the image load faster', 'Adding a copyright notice', 'Showing the file name'),
    explain: 'Screen readers read alt text aloud, and browsers show it when an image fails to load. It is a core accessibility requirement.',
  });
  add('call-ai-image', 'callout', { tone: 'IMPORTANT', body: '**Honest images.** Label AI images (“AI-generated illustration”). Never present an AI face as a real staff member or patient. Team photos on this fictional site should be illustrations, initials or neutral images.' });

  add('task-services-team', 'task', { title: 'Services and Team pages', time: '8 min', body: text(
    '**Why this matters:** these are the pages visitors read most — they explain what help exists and who gives it.', '',
    '1. Open **Pages › All Pages** and click **Services**.', '2. Click **+**, open **Patterns**, and insert a pattern with three columns or cards.',
    '3. Send the services prompt below to ChatGPT.', '4. Paste one service into each card: **CBT**, **Counselling**, **Psychological assessment**.',
    '5. Click **Save**.', '6. Open **Team**. Insert a team pattern and add 3 **fictional** psychologists: name, role (e.g. *Clinical Psychologist*), one-line focus. No real people.',
    '7. Click **Save**.',
  ) });
  add('prompt-services', 'prompt', {
    title: 'Service descriptions', tool: 'ChatGPT',
    prompt: text(
      'Write three service descriptions for the Services page of a psychology clinic website:',
      '[Cognitive Behavioural Therapy (CBT)], [Counselling], [Psychological assessment].',
      '',
      'For each one give: a heading, a 40–60 word description of what it is and who it may help, "What a session looks like" in one sentence, and a button label.',
      'Be accurate to how these services are described by professional bodies (e.g. the British Psychological Society or APA). Warm, plain English. No prices, no guarantees, no claims of curing anything.',
    ),
    expect: 'Three balanced cards. CBT is described as a structured talking therapy that links thoughts, feelings and behaviour; assessment as carried out and interpreted by a qualified psychologist.',
  });

  add('task-styles', 'task', { title: 'Global styles: your brand everywhere at once', time: '12 min', body: text(
    '**Why this matters:** change a colour or font once and every page updates — the power of separating content from design.', '',
    '1. Hover over **Appearance** and click **Editor**.', '2. In the left sidebar, click **Styles**.',
    '3. Click a few of the ready-made **style variations** and watch the preview change. Pick the calmest one.',
    '4. Click the **Edit styles** (pencil) icon.', '5. Click **Colors**, then **Palette**.',
    '6. Click a colour swatch and paste one of your brand hex codes from your *Website notes*. Repeat for the others.',
    '7. Go back (arrow at the top of the panel) and click **Typography** to choose your heading and body fonts.',
    '8. Click **Save** (top right), then **Save** again if asked.', '',
    '**Your turn (no steps given):** change the colour of **all buttons** on the site to your primary brand colour, using **Styles** only. *Hint: look for **Blocks › Button** or the Elements settings in Styles.*',
  ) });
  add('path-styles', 'clickpath', { title: 'Global styles', steps: text('Dashboard', 'Appearance', 'Editor', 'Styles', 'Style variations / Edit styles', 'Colors › Palette · Typography', 'Save') });
  add('check-styles', 'checkpoint', { body: 'Success: every page uses your colours and fonts, and **every button** on the site (Home, Services, About) has your primary colour — without editing any page one by one.' });
  add('quiz-styles', 'quiz', {
    question: 'You want all headings on all pages in a new font. What is the fastest correct way?',
    options: text('*Appearance › Editor › Styles › Typography — change it once', 'Open each page and change each heading', 'Write a new post', 'Upload the font to the Media Library'),
    explain: '**Global styles** apply to the whole site. Editing page by page is slow and leaves inconsistencies.',
  });

  add('task-animate', 'task', { title: 'Animate blocks without code', time: '8 min', body: text(
    '**Why this matters:** gentle motion draws the eye to what matters — but on a mental-health site it must stay calm.', '',
    '1. Hover over **Plugins** and click **Installed Plugins**.',
    '2. Find *Blocks Animation*. If you see **Activate**, click it. If you see **Deactivate**, it is already on. If it is missing (for example, you used the startup fallback), choose **Plugins → Add New Plugin**, search **Blocks Animation**, then **Install Now → Activate**.',
    '3. Open **Pages › All Pages › Home**.', '4. Click the main heading to select it.',
    '5. In the right sidebar (**Block** tab), scroll to the new **animation** settings.',
    '6. Choose a gentle effect such as *fade in* or *fade in up*.',
    '7. Do the same for the service cards and one image — **3–4 animations in total**.', '8. Click **Save** and view the page.', '',
    'Never use flashing effects: they can trigger seizures.',
  ) });
  add('path-plugin', 'clickpath', { title: 'Install a plugin (on other WordPress sites)', steps: text('Dashboard', 'Plugins', 'Add New Plugin', 'Search: Blocks Animation', 'Install Now', 'Activate') });

  add('task-edit-code', 'task', { title: 'Exercise: change AI-written code', time: '10 min', body: text(
    '**Why this matters:** you do not need to *write* code to *adjust* it. Changing a value and checking the result is the skill that makes “ChatGPT coding” safe.', '',
    'The sandbox below holds a small card that ChatGPT wrote. Lines marked `CHANGE` are the ones you edit.', '',
    '1. Find `CHANGE 1`. Replace `#e8f2ee` with one of **your** brand colours (keep the `#` and the `;`).',
    '2. Press **Run**. The card’s background changes.', '3. Find `CHANGE 2`. Replace *You are not alone* with your own heading.',
    '4. Press **Run**.', '5. Find `CHANGE 3`. Change `1s` to `2s` (two seconds) and press **Run** — the card rises more slowly.',
    '6. Broke it? Press **Ctrl/Cmd + Z** until it works again. Only change what is between the colons and semicolons.',
  ) });
  add('sandbox-edit', 'websandbox', {
    title: 'Change three values',
    goal: 'Change the **background colour**, the **heading text** and the **animation speed**, then press **Run** after each change.',
    hint: 'A colour code is # plus 6 characters, like #D9D3F2. The speed is a number followed by s (seconds).',
    starter: EDIT_SANDBOX_STARTER,
  });
  add('check-edit', 'checkpoint', { body: 'Success: the card has **your** background colour, **your** heading, and rises slowly over 2 seconds. Nothing else broke.' });
  add('quiz-css', 'quiz', {
    question: 'In the line `background: #e8f2ee;` — which part do you change to get a different colour?',
    options: text('*#e8f2ee', 'background', 'the colon :', 'the semicolon ;'),
    explain: 'CSS is written as **property: value;**. The property (`background`) says *what* to style; the value (`#e8f2ee`) says *how*. Change only the value.',
  });

  add('task-hero-code', 'task', { title: '“ChatGPT coding”: an animated hero', time: '15 min', body: text(
    '**Why this matters:** you can add things no pattern offers by describing them clearly to ChatGPT, then testing before you publish.', '',
    '1. Look at the animated example section below.', '2. Copy the hero prompt and replace the brackets with your clinic name, colours and text.',
    '3. Send it to ChatGPT.', '4. Under the code ChatGPT gives you, click **Copy code**.',
    '5. In the **sandbox** below, click inside the editor, press **Ctrl/Cmd + A**, then **Ctrl/Cmd + V**.', '6. Press **Run**. Check it at **phone** size too.',
    '7. Not right? Tell ChatGPT exactly what is wrong (“the text is too small on phones”) and test again.',
    '8. Works? Open **Pages › All Pages › Home**.', '9. Click **+**, type `Custom HTML` in the search box, and click the **Custom HTML** block.',
    '10. Click inside the block and paste the code.', '11. Click **Preview** in the block’s toolbar to check it.', '12. Click **Save**.',
  ) });
  add('browser-section', 'browser', {
    title: 'Example: an animated “How therapy works” section', url: 'mindcare-clinic.example/#how-it-works', html: PROCESS_PREVIEW, height: 'Medium',
    caption: 'Steps rise in one after another while a line draws across. With “reduce motion” switched on in your computer’s settings, it appears instantly.',
  });
  add('prompt-hero', 'prompt', {
    title: 'Animated hero section (HTML + CSS)', tool: 'ChatGPT',
    prompt: text(
      'I have no coding experience. Write ONE self-contained snippet of HTML with a <style> tag (no JavaScript, no external images) that I can paste into a WordPress "Custom HTML" block.',
      '',
      'It is the hero (top section) of the homepage of [MindCare Psychology Clinic].',
      '- Heading: [Feel understood. Find your way forward.]',
      '- Short text: [Evidence-based psychological care for adults, teens and families.]',
      '- Two buttons: [Explore our services] linking to [/services/] and [Contact us] linking to [/contact/]',
      '- Colours: background [#FBF8F3], text [#17323A], primary [#0F5C6B], soft shapes in [#8FBFAE] and [#D9D3F2]',
      '- Animation: 2–3 blurred, softly floating gradient circles in the background (slow, 12+ seconds), and the heading, text and buttons fading and sliding up one after another.',
      '',
      'Requirements:',
      '- Put every class name under a unique prefix like .mc-hero so it cannot break my theme.',
      '- Responsive: looks good from phone (360px) to desktop; buttons at least 44px tall.',
      '- Accessible: good contrast; use an <h2> for the heading (the page already has a title); mark decorative shapes with aria-hidden="true".',
      '- Include @media (prefers-reduced-motion: reduce) that turns all animation off and shows everything immediately.',
      '- Return only the code in one code block, then 3 short bullet points explaining what to change for colours, text and speed.',
    ),
    expect: 'One code block starting with `<style>` and a `<section class="mc-hero">`, `@keyframes` for floating and fading, a `prefers-reduced-motion` rule, no `<script>`. It runs in the sandbox without errors.',
  });
  add('sandbox-hero', 'websandbox', {
    title: 'Test your hero before WordPress',
    goal: 'Paste the hero code from ChatGPT and press **Run**. It is ready when: the text is readable, the motion is slow and calm, it fits the **phone** size, and nothing overlaps the buttons.',
    hint: 'Blank preview? Make sure you copied the whole code block, from the first <style> to the last </section>. Ask ChatGPT: “It shows nothing when I paste it — please check the code is complete.”',
    starter: HERO_SANDBOX_STARTER,
  });
  add('path-custom-html', 'clickpath', { title: 'Paste code into WordPress', steps: text('Pages', 'Home', '+ Block Inserter', 'Search: Custom HTML', 'Paste code', 'Preview', 'Save') });
  stuck('stuck-html-text', 'My page shows the code as text (<style>… on the page)',
    '1. You pasted into a normal **Paragraph** block. Click that block, press **Ctrl/Cmd + A** inside it, then **Delete**.',
    '2. Click **+**, search `Custom HTML` and insert **that** block.', '3. Paste the code inside the Custom HTML block and click **Preview**.',
    '4. Check the code starts with `<style>` or `<section>` — not with ```` ``` ```` or ChatGPT’s explanation text.',
  );
  add('call-code-safety', 'callout', { tone: 'CAUTION', body: 'Only paste code you have tested that contains **no `<script>`** tags or links to unknown websites. If ChatGPT adds JavaScript, ask for “HTML and CSS only”. Custom HTML is powerful — that is why only Administrators and Editors can use it.' });
  add('quiz-custom-html', 'quiz', {
    question: 'Where do you paste HTML/CSS code from ChatGPT so that WordPress shows the design instead of the code?',
    options: text('*In a Custom HTML block', 'In a Paragraph block', 'In the post title', 'In the Media Library'),
    explain: 'A **Custom HTML** block tells WordPress “this is code, display its result”. A Paragraph block shows whatever you type — including the code itself.',
  });
  add('check-hero', 'checkpoint', { body: 'Success: your Home page starts with an animated hero that you tested in the sandbox, with your text and colours, and it looks right at phone width.' });

  add('task-faq', 'task', { title: 'Your turn: write your own prompt for an FAQ section', time: '8 min', body: text(
    '**Why this matters:** good results come from good prompts. Now you write one from scratch.', '',
    '1. In your *Website notes*, write a prompt asking ChatGPT for **5 frequently asked questions** with answers for your clinic (e.g. *Is it confidential?*, *How long is a session?*).',
    '2. Your prompt must include: **who** the AI should be, the **audience**, the **tone**, the **length**, and at least **two rules** (e.g. no diagnosis, no prices).',
    '3. Send it and judge the answer against the checkpoint below.', '4. If it fails a point, reply to ChatGPT to fix that point.',
    '5. Add the FAQ to your **Contact** or **About** page (a **Details** block makes a neat open/close question).',
  ) });
  add('check-faq', 'checkpoint', { body: text(
    'Success — the answer:', '',
    '- Has exactly 5 questions with short answers (2–3 sentences)', '- Is warm and plain, with no jargon',
    '- Does not diagnose, promise results or invent facts (e.g. a fake price or waiting time is labelled as an example)',
    '- Mentions confidentiality honestly and what to do in an emergency', '- Your prompt contains role, audience, tone, length and two rules',
  ) });

  add('task-ethics', 'task', { title: 'Footer disclaimer and final ethics check', time: '8 min', body: text(
    '**Why this matters:** a health website must be honest about what it is, on every page.', '',
    '1. Hover over **Appearance** and click **Editor**.', '2. Click **Patterns**, then under **Template Parts** click **Footer**.',
    '3. Click where you want the text, press **Enter** for a new Paragraph block.', '4. Paste the disclaimer from the footer prompt below.',
    '5. Click **Save**. The footer appears on **every** page — you edited it once.', '',
    'Then check the whole site:', '',
    '- [ ] No diagnosis, cure claims or fake reviews', '- [ ] Emergency information in the footer and on Contact', '- [ ] Sources on every condition post',
    '- [ ] Alt text on meaningful images; AI images labelled', '- [ ] Link text makes sense alone (“Read about anxiety”, not “click here”)', '- [ ] The footer says the clinic is fictional',
  ) });
  add('prompt-footer', 'prompt', {
    title: 'Footer disclaimer', tool: 'ChatGPT',
    prompt: text(
      'Write a short footer disclaimer (max 60 words) for an informational psychology clinic website in [Egypt].',
      'It must say: the content is for general information and is not medical advice or a diagnosis; readers should speak to a qualified professional; in an emergency call [123 (ambulance)] or go to the nearest emergency department.',
      'Also add one line saying: "[MindCare] is a fictional clinic created for a university class. Some illustrations are AI-generated."',
      'Calm, non-alarming tone.',
    ),
    expect: 'Two to three calm sentences covering: information only, not a diagnosis, see a professional, the emergency number, and the fictional-site/AI-image note.',
  });
  add('call-emergency', 'callout', { tone: 'NOTE', body: '123 is Egypt’s ambulance number. For any other country, look up the official emergency and mental-health helpline numbers on a government or health-service website — never from ChatGPT alone.' });

  add('task-final', 'task', { title: 'Final checklist, export and screenshots', time: '8 min', body: text(
    '**Definition of done** — tick each one:', '',
    '- [ ] Site title and tagline set; Home is the static homepage; Resources is the posts page',
    '- [ ] 7 published pages and a menu with six working links (also on phone width)',
    '- [ ] 2+ condition posts in **Conditions**, with tags and checked sources',
    '- [ ] 3+ images with alt text; free images credited; AI images labelled',
    '- [ ] Brand colours, fonts and button colour set in **Styles**',
    '- [ ] 3–4 block animations + an animated hero tested in the sandbox',
    '- [ ] FAQ section; footer disclaimer with emergency info and the “fictional clinic” note', '',
    '**Hand in**', '',
    '1. In the Dock, click **Export › Download as .zip**.', '2. Rename it `mindcare-[your-student-id].zip`.',
    '3. Take 3 screenshots (Windows: **Win + Shift + S** · Mac: **Cmd + Shift + 4**): Home on desktop, Home at phone width, and one condition post.',
    '4. Upload the zip and screenshots where your instructor asks.', '',
    '**Want a public web address later?** Playground sites stay in your browser. A free **WordPress.com** site gives a public `yoursite.wordpress.com` link, but the free plan does not allow installing plugins (so no Blocks Animation) and limits custom code; you would rebuild the content there. Ask your instructor before publishing anything publicly.',
  ) });
  add('check-final', 'checkpoint', { body: 'Success: your zip and screenshots are handed in, and you can explain in your own words: page vs post, category vs tag, draft vs published, and why alt text matters.' });

  add('task-bonus-section', 'task', { title: `${BONUS} An animated “How therapy works” or stats section`, time: '10 min', body: text(
    '*Optional — for fast finishers.* Repeat the loop **prompt → sandbox → Custom HTML** for one more Home page section:', '',
    '- **How therapy works:** 3–4 steps that appear one after another (like the example above), or',
    '- **The clinic in numbers:** 3 numbers that count up (fictional is fine — the footer says the site is fictional).',
  ) });
  add('prompt-section', 'prompt', {
    title: 'Animated steps or stats section', tool: 'ChatGPT',
    prompt: text(
      'Write ONE self-contained HTML snippet with a <style> tag (HTML and CSS only, no JavaScript) for a WordPress Custom HTML block on a psychology clinic homepage.',
      'Section: [How therapy works] with these steps: [1. Get in touch · 2. First conversation · 3. Your plan · 4. Regular sessions], each with one short sentence.',
      '(Or instead: [The clinic in numbers] with [12 psychologists · 15+ years · 4 languages] where the numbers count up using CSS only, with @property.)',
      'Colours: [#0F5C6B, #8FBFAE, #FBF8F3, #17323A]. Fonts: inherit from the theme.',
      'Animation: items fade and rise in one after another; [a line draws across between the steps]. Gentle and slow.',
      'Prefix all classes with .mc-steps. Responsive (stack vertically on phones). Use an ordered list for steps. Include @media (prefers-reduced-motion: reduce) that removes all animation and shows the final state. Return only the code, then 2 bullet points on how to change the text.',
    ),
    expect: 'An `<ol>` of steps (or three numbers), staggered `animation-delay`s, a phone layout, and a `prefers-reduced-motion` block. Counters show their **final** numbers when motion is reduced.',
  });
  add('sandbox-section', 'websandbox', {
    title: 'Test your section',
    goal: 'Paste the section from ChatGPT, press **Run**, and check it on **phone** size. Then paste it into a **Custom HTML** block under your hero.',
    hint: 'If the counters show 0, ask ChatGPT: “Make the final number the default value so it still shows when animation is off or unsupported.”',
    starter: SECTION_SANDBOX_STARTER,
  });

  add('task-bonus-roles', 'task', { title: `${BONUS} Revisions, users and roles`, time: '10 min', body: text(
    '*Optional — for fast finishers.*', '',
    '**Revisions**', '1. Open a page you edited several times.', '2. In the right sidebar (**Page** tab), click **Revisions**.',
    '3. Drag the slider to compare versions. **Restore** would bring an old one back — mistakes are never permanent.', '',
    '**Users and roles** — a clinic would not give every staff member full control:', '',
    '| Role | Can… | Clinic example |', '| --- | --- | --- |',
    '| Administrator | Everything: plugins, themes, users | The web manager |', '| Editor | Publish and edit anyone’s posts and pages | Clinic director |',
    '| Author | Publish and edit their own posts | A psychologist writing articles |', '| Contributor | Write drafts, cannot publish | A trainee; the director reviews |',
    '| Subscriber | Only manage their own profile | — |', '',
    '1. Hover over **Users** and click **Add New User**.', '2. Fill in a fictional username and email, e.g. `trainee@mindcare.example`.',
    '3. Set **Role** to **Contributor**.', '4. Click **Add New User**.',
  ) });
  add('path-users', 'clickpath', { title: 'Add a user', steps: text('Dashboard', 'Users', 'Add New User', 'Role: Contributor', 'Add New User') });
  add('quiz-roles', 'quiz', {
    question: 'A trainee psychologist should write articles, but a senior psychologist must review them before they go live. Which role fits the trainee?',
    options: text('*Contributor', 'Administrator', 'Editor', 'Author'),
    explain: 'A **Contributor** can write and save drafts but cannot publish. An Editor reviews and publishes them — like clinical supervision for content.',
  });

  add('call-proud', 'callout', { tone: 'TIP', body: 'You just used the same tools professional web teams use: a CMS, a design system, accessibility checks and AI as an assistant — with you as the responsible author. Write two sentences in your notes: what was easiest, and what you would improve next.' });
  return steps;
}

const SHARED_OBJECTIVE_NOTE = 'Written for complete beginners: no technology or coding experience and no installation needed.';

/** Lab 01 — Session 1: plan the site, set up WordPress and build the pages. */
export function psychologyTechnologyLab01(): Flow {
  const all = bootcampSteps();
  const s1 = all.slice(0, all.findIndex((st) => st.id === 'part-s2'));
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'Lab 01 — WordPress Bootcamp, Session 1: Plan, Set Up and Build Your Clinic Website',
      description: `In the first session you plan a calm, informative website for a fictional psychology clinic with ChatGPT, open WordPress in your browser and build its pages and menu with the content management system. ${SHARED_OBJECTIVE_NOTE}`,
      difficulty: 'Beginner', estimatedTime: '2 hours',
      objectives: text(
        'Explain in plain words what a website, a browser, a web address and a content management system (CMS) are',
        'Plan an informative website (audience, pages, tone) for a psychology clinic with help from ChatGPT',
        'Find your way around the WordPress Dashboard and set the site title',
        'Tell pages from posts, and drafts from published content',
        'Build pages from block patterns and connect them with a navigation menu',
        'Save, export and restore a complete WordPress site',
      ),
    } },
    { id: 'call-instructor', type: 'callout', data: { tone: 'NOTE', body: text(
      '**For the instructor — Session 1 plan (≈ 2 h; “Bonus —” tasks are for fast finishers)**', '',
      '| Minutes | Focus |', '| --- | --- |',
      '| 0–10 | Orientation: website, browser, CMS, glossary, keyboard basics, target site |',
      '| 10–33 | Plan the site and brand with ChatGPT |',
      '| 33–53 | Launch WordPress Playground · Dashboard tour · site title |',
      '| 53–95 | Pages vs posts · build About **together** (demo on projector) · students build the other pages alone |',
      '| 95–112 | Homepage setting · navigation menu |',
      '| 112–120 | **Store permanently + Download as .zip** — walk the room and check every laptop |', '',
      'Before the session: open the Playground link once on the lab network (it downloads WordPress into the browser, about 30 s). Students need a free ChatGPT login, or pair up. Demo task 1.7 live; students then repeat the skill alone in 1.8. The quick checks are short — use the answers for a 1-minute class discussion. Remind everyone to keep `mindcare-session1.zip`: Lab 02 starts from it.',
    ) } },
    ...s1,
    { id: 'checkin', type: 'checkin', data: {} },
  ]);
}

/** Lab 02 — Session 2: CMS content, images, design, animation and the finished site. */
export function psychologyTechnologyLab02(): Flow {
  const all = bootcampSteps();
  const s2 = all.slice(all.findIndex((st) => st.id === 'part-s2'));
  return chain([
    { id: 'root', type: 'start', data: {
      title: 'Lab 02 — WordPress Bootcamp, Session 2: Content, Design, Animation and Export',
      description: `In the second session you restore the site you built in Lab 01, fill it with organised content using the CMS, add images with alt text, style and animate it (with a plugin and ChatGPT-written code tested first), then run an ethics and accessibility check and export the finished site. ${SHARED_OBJECTIVE_NOTE}`,
      difficulty: 'Beginner', estimatedTime: '2 hours',
      objectives: text(
        'Restore a WordPress site from a backup',
        'Organise content with categories and posts, and show it with a Query Loop',
        'Use the Media Library with meaningful alt text and properly credited or clearly labelled AI images',
        'Design with global styles and add gentle animation with a plugin',
        'Test ChatGPT-written HTML/CSS in a sandbox, then add it with a Custom HTML block',
        'Judge AI output critically: accurate mental-health information, no diagnosis claims, no patient data, accessibility',
        'Export the finished site and check it against a definition of done',
      ),
    } },
    { id: 'call-instructor', type: 'callout', data: { tone: 'NOTE', body: text(
      '**For the instructor — Session 2 plan (≈ 2 h; “Bonus —” tasks are for fast finishers)**', '',
      '| Minutes | Focus |', '| --- | --- |',
      '| 0–30 | Restore the site · categories · first condition post together, second one alone |',
      '| 30–50 | “Spot the problem” critique of a weak AI answer · Media Library and alt text |',
      '| 50–78 | Services and Team · global styles + “your turn” button colour · Blocks Animation plugin |',
      '| 78–103 | Edit AI-written code in the sandbox · animated hero into a Custom HTML block |',
      '| 103–127 | FAQ prompt “your turn” · footer disclaimer · final checklist, export, check-in |', '',
      'Students start from their Lab 01 site: the copy stored in the browser, or `mindcare-session1.zip`. Have a spare finished-Session-1 .zip on a USB stick or shared drive for anyone whose save was lost, so nobody spends the session rebuilding.',
    ) } },
    { id: 'call-recap', type: 'callout', data: { tone: 'TIP', body: 'New here, or need a refresher? The glossary, keyboard basics and the target design are in **Lab 01 — task 1.1**. Today you keep building the same *MindCare* site.' } },
    ...s2,
    { id: 'checkin', type: 'checkin', data: {} },
  ]);
}

/** The module canvas: Technology for Psychology (Arts & Humanities): Week 1 → Lab 01 (Session 1), Week 2 → Lab 02 (Session 2). */
export function psychologyTechnologyModule(): Flow {
  const flow: Flow = {
    nodes: [
      {
        id: 'module', type: 'module', x: 100, y: 100, data: {
          code: 'PSY-TECH', title: 'Technology for Psychology', term: '2026–2027 · Semester One',
          description: 'Practical digital skills for psychology students: build and manage websites with a content management system, use AI assistants responsibly, and communicate mental-health information accurately, accessibly and ethically. No coding background needed.',
          color: '#8fbfae', faculty: 'arts-humanities', leader: '', open: 'No', category: 'Core', years: '', semester: 'Semester 1', specializations: 'Psychology',
        },
      },
      { id: 'week-01', type: 'divider', x: 100, y: 260, data: { title: 'Week 1' } },
      { id: 'lab-01', type: 'lab', x: 100, y: 420, data: { slug: 'lab-01' } },
      { id: 'week-02', type: 'divider', x: 100, y: 580, data: { title: 'Week 2' } },
      { id: 'lab-02', type: 'lab', x: 100, y: 740, data: { slug: 'lab-02' } },
      { id: 'week-03', type: 'divider', x: 100, y: 900, data: { title: 'Week 3' } },
      { id: 'lab-03', type: 'lab', x: 100, y: 1060, data: { slug: 'lab-03' } },
    ],
    edges: [{ from: 'module', to: 'week-01' }, { from: 'week-01', to: 'lab-01' }, { from: 'lab-01', to: 'week-02' }, { from: 'week-02', to: 'lab-02' }, { from: 'lab-02', to: 'week-03' }, { from: 'week-03', to: 'lab-03' }],
  };
  const clean = sanitizeFlow(flow, 'module');
  if (!clean.ok) throw new Error(clean.error);
  return clean.value;
}
