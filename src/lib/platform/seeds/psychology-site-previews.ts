/**
 * Self-contained HTML + CSS for the Website preview (browser) and Web sandbox nodes of the
 * Technology for Psychology bootcamp (psychology-technology-lab-01.ts). Fictional clinic, demo content.
 * Every snippet respects prefers-reduced-motion and stays well under 20 KB.
 */

/** The target: a finished, animated homepage for the fictional MindCare Psychology Clinic. */
export const HOMEPAGE_PREVIEW = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MindCare Psychology Clinic</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap">
<style>
  :root {
    --ink: #17323a; --muted: #4c6670; --teal: #0f5c6b; --sage: #8fbfae; --mist: #e8f2ee;
    --cream: #fbf8f3; --lavender: #d9d3f2; --coral: #e07a5f; --card: #ffffff;
    --serif: "Fraunces", Georgia, "Times New Roman", serif;
    --sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--sans); color: var(--ink); background: var(--cream); line-height: 1.6; }
  a { color: inherit; }
  .wrap { width: min(1100px, 100% - 40px); margin-inline: auto; }

  /* header */
  header { position: sticky; top: 0; z-index: 5; background: rgb(251 248 243 / .85); backdrop-filter: blur(8px); border-bottom: 1px solid #e6e1d8; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; }
  .logo { display: flex; align-items: center; gap: 10px; font-family: var(--serif); font-weight: 700; font-size: 1.2rem; text-decoration: none; }
  .logo i { width: 30px; height: 30px; border-radius: 50% 50% 50% 12px; background: linear-gradient(135deg, var(--teal), var(--sage)); display: inline-block; }
  nav ul { display: flex; gap: 22px; list-style: none; margin: 0; padding: 0; font-size: .92rem; font-weight: 500; }
  nav a { text-decoration: none; opacity: .8; }
  nav a:hover { opacity: 1; text-decoration: underline; text-underline-offset: 4px; }

  /* hero */
  .hero { position: relative; overflow: hidden; padding: 84px 0 96px; }
  .blob { position: absolute; border-radius: 50%; filter: blur(48px); opacity: .55; animation: float 14s ease-in-out infinite alternate; }
  .b1 { width: 360px; height: 360px; background: var(--sage); top: -80px; right: -60px; }
  .b2 { width: 300px; height: 300px; background: var(--lavender); bottom: -120px; left: 30%; animation-delay: -5s; }
  .b3 { width: 200px; height: 200px; background: #f6c9b5; top: 40%; right: 26%; animation-delay: -9s; }
  .hero .wrap { position: relative; display: grid; grid-template-columns: 1.2fr .8fr; gap: 48px; align-items: center; }
  .eyebrow { display: inline-block; font-size: .78rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--teal); background: var(--mist); padding: 6px 12px; border-radius: 999px; }
  h1 { font-family: var(--serif); font-weight: 700; font-size: clamp(2.2rem, 5vw, 3.6rem); line-height: 1.08; margin: 18px 0 16px; }
  h1 em { font-style: normal; color: var(--teal); background: linear-gradient(transparent 62%, rgb(143 191 174 / .45) 0); }
  .lead { font-size: 1.1rem; color: var(--muted); max-width: 34ch; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
  .btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px; border-radius: 999px; font-weight: 600; text-decoration: none; transition: transform .2s, box-shadow .2s; }
  .btn.primary { background: var(--teal); color: #fff; box-shadow: 0 10px 24px -12px var(--teal); }
  .btn.ghost { border: 1.5px solid var(--teal); color: var(--teal); }
  .btn:hover { transform: translateY(-2px); }
  .care { background: var(--card); border-radius: 28px; padding: 26px; box-shadow: 0 30px 60px -30px rgb(23 50 58 / .35); }
  .care h2 { font-family: var(--serif); font-size: 1.25rem; margin: 0 0 12px; }
  .care li { list-style: none; display: flex; gap: 10px; padding: 9px 0; border-top: 1px solid #eee8de; font-size: .95rem; }
  .care ul { margin: 0; padding: 0; }
  .care li::before { content: ""; flex: none; width: 10px; height: 10px; margin-top: 8px; border-radius: 50%; background: var(--sage); }

  /* entrance animations */
  .rise { opacity: 0; animation: rise .9s cubic-bezier(.2,.7,.2,1) forwards; }
  .d1 { animation-delay: .1s; } .d2 { animation-delay: .25s; } .d3 { animation-delay: .4s; } .d4 { animation-delay: .55s; }

  /* sections */
  section { padding: 72px 0; }
  .head { max-width: 60ch; margin-bottom: 32px; }
  .head h2 { font-family: var(--serif); font-size: clamp(1.7rem, 3.4vw, 2.4rem); margin: 8px 0; line-height: 1.15; }
  .head p { color: var(--muted); margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .card { background: var(--card); border-radius: 22px; padding: 26px; border: 1px solid #ece6dc; transition: transform .25s, box-shadow .25s; }
  .card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -24px rgb(23 50 58 / .4); }
  .icon { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 1.3rem; margin-bottom: 14px; }
  .card h3 { margin: 0 0 6px; font-size: 1.1rem; }
  .card p { margin: 0; color: var(--muted); font-size: .95rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chip { padding: 10px 18px; border-radius: 999px; background: var(--card); border: 1px solid #e3ddd2; font-weight: 500; }

  /* stats with CSS-only counters */
  @property --n { syntax: "<integer>"; initial-value: 0; inherits: false; }
  .stats { background: var(--teal); color: #fff; border-radius: 32px; padding: 44px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; text-align: center; }
  .num { --n: var(--to); counter-reset: n var(--n); font-family: var(--serif); font-size: 2.8rem; font-weight: 700; animation: count 2.4s ease-out forwards; }
  .num::after { content: counter(n) attr(data-suffix); }
  .stats p { margin: 4px 0 0; opacity: .85; }

  /* footer */
  footer { background: #10282f; color: #d7e4e0; padding: 48px 0 32px; font-size: .92rem; }
  footer .cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 32px; }
  .notice { border-left: 4px solid var(--coral); background: rgb(255 255 255 / .06); padding: 14px 18px; border-radius: 0 14px 14px 0; }
  .notice strong { color: #fff; }
  .small { opacity: .7; margin-top: 28px; font-size: .82rem; }

  @keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
  @keyframes float { from { transform: translate(0, 0) scale(1); } to { transform: translate(40px, 30px) scale(1.12); } }
  @keyframes count { from { --n: 0; } }

  @media (max-width: 820px) {
    nav ul { display: none; }
    .hero .wrap, .grid, .stats, footer .cols { grid-template-columns: 1fr; }
    .hero { padding: 56px 0 64px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .rise { opacity: 1; }
  }
</style>
</head>
<body>
<header>
  <div class="wrap bar">
    <a class="logo" href="#"><i aria-hidden="true"></i>MindCare</a>
    <nav aria-label="Main"><ul>
      <li><a href="#">About</a></li><li><a href="#">Services</a></li><li><a href="#">Conditions</a></li>
      <li><a href="#">Team</a></li><li><a href="#">Resources</a></li><li><a href="#">Contact</a></li>
    </ul></nav>
  </div>
</header>

<main>
<section class="hero" aria-labelledby="hero-title">
  <span class="blob b1" aria-hidden="true"></span><span class="blob b2" aria-hidden="true"></span><span class="blob b3" aria-hidden="true"></span>
  <div class="wrap">
    <div>
      <span class="eyebrow rise d1">Psychology clinic · Cairo</span>
      <h1 id="hero-title" class="rise d2">Feel understood. <em>Find your way forward.</em></h1>
      <p class="lead rise d3">Evidence-based psychological care from qualified, caring clinicians, for adults, teens and families.</p>
      <div class="actions rise d4">
        <a class="btn primary" href="#">Explore our services</a>
        <a class="btn ghost" href="#">How therapy works</a>
      </div>
    </div>
    <aside class="care rise d4" aria-label="What to expect">
      <h2>What to expect</h2>
      <ul>
        <li>A warm, confidential first conversation</li>
        <li>A plan built around your goals</li>
        <li>Approaches backed by research, such as CBT</li>
        <li>Sessions in person or online</li>
      </ul>
    </aside>
  </div>
</section>

<section aria-labelledby="services-title">
  <div class="wrap">
    <div class="head"><span class="eyebrow">Services</span><h2 id="services-title">Support that fits you</h2><p>Every service starts with listening. Your psychologist explains each step before you begin.</p></div>
    <div class="grid">
      <article class="card"><div class="icon" style="background:#e8f2ee" aria-hidden="true">🧠</div><h3>Cognitive Behavioural Therapy</h3><p>A structured, practical therapy that helps you notice and change unhelpful patterns of thinking and behaviour.</p></article>
      <article class="card"><div class="icon" style="background:#ece8fa" aria-hidden="true">💬</div><h3>Counselling</h3><p>A safe space to talk through life changes, loss, stress or relationships with a trained professional.</p></article>
      <article class="card"><div class="icon" style="background:#fbe9e1" aria-hidden="true">📋</div><h3>Psychological assessment</h3><p>Standardised assessments, carried out and explained by a qualified psychologist, to guide the right support.</p></article>
    </div>
  </div>
</section>

<section aria-labelledby="conditions-title" style="padding-top:0">
  <div class="wrap">
    <div class="head"><span class="eyebrow">Conditions we help with</span><h2 id="conditions-title">You are not alone</h2></div>
    <div class="chips"><span class="chip">Anxiety</span><span class="chip">Depression</span><span class="chip">Stress &amp; burnout</span><span class="chip">Sleep difficulties</span><span class="chip">Grief &amp; loss</span><span class="chip">Exam stress</span></div>
  </div>
</section>

<section aria-label="The clinic in numbers" style="padding-top:0">
  <div class="wrap stats">
    <div><div class="num" style="--to:12" data-suffix=""></div><p>qualified psychologists</p></div>
    <div><div class="num" style="--to:15" data-suffix="+"></div><p>years of practice</p></div>
    <div><div class="num" style="--to:4" data-suffix=""></div><p>languages spoken</p></div>
  </div>
</section>
</main>

<footer>
  <div class="wrap cols">
    <div>
      <p class="logo" style="color:#fff">MindCare Psychology Clinic</p>
      <p>12 Example Street, New Cairo · Sunday to Thursday, 10:00–18:00<br>hello@mindcare.example</p>
    </div>
    <div class="notice" role="note">
      <strong>This website is for information only.</strong> It is not medical advice and cannot diagnose. If you or someone else is in danger, call <strong>123</strong> (ambulance, Egypt) or go to the nearest emergency department.
    </div>
  </div>
  <p class="wrap small">MindCare is a fictional clinic created for a university class. Illustrations generated with AI are labelled.</p>
</footer>
</body>
</html>`;

/** An animated "How therapy works" section: staggered steps, a drawing progress line and pulsing dots. */
export const PROCESS_PREVIEW = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --ink: #17323a; --muted: #4c6670; --teal: #0f5c6b; --sage: #8fbfae; --cream: #fbf8f3; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 40px 20px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink);
    background: radial-gradient(circle at 15% 20%, #e3efe9, transparent 45%), radial-gradient(circle at 85% 80%, #ebe6fa, transparent 45%), var(--cream); }
  .how { width: min(980px, 100%); text-align: center; }
  .tag { font-size: .78rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--teal); }
  h2 { font-family: Georgia, "Times New Roman", serif; font-size: clamp(1.8rem, 4vw, 2.6rem); margin: 8px 0 40px; }
  .steps { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; list-style: none; margin: 0; padding: 0; }
  .steps::before { content: ""; position: absolute; top: 28px; left: 12%; right: 12%; height: 3px; border-radius: 3px;
    background: linear-gradient(90deg, var(--teal), var(--sage)); transform-origin: left; animation: draw 2.4s .3s ease-out both; }
  .step { position: relative; opacity: 0; animation: up .8s ease-out forwards; }
  .step:nth-child(1) { animation-delay: .3s; } .step:nth-child(2) { animation-delay: .9s; }
  .step:nth-child(3) { animation-delay: 1.5s; } .step:nth-child(4) { animation-delay: 2.1s; }
  .dot { position: relative; width: 58px; height: 58px; margin: 0 auto 16px; border-radius: 50%; display: grid; place-items: center;
    background: #fff; border: 3px solid var(--teal); font-weight: 800; color: var(--teal); font-size: 1.2rem; }
  .dot::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; border: 2px solid var(--sage); animation: pulse 2.6s ease-out infinite; }
  .step h3 { margin: 0 0 6px; font-size: 1.05rem; }
  .step p { margin: 0 auto; max-width: 24ch; color: var(--muted); font-size: .93rem; line-height: 1.5; }
  @keyframes draw { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes up { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
  @keyframes pulse { 0% { transform: scale(.85); opacity: .9; } 100% { transform: scale(1.35); opacity: 0; } }
  @media (max-width: 700px) {
    .steps { grid-template-columns: 1fr; gap: 28px; }
    .steps::before { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; }
    .step { opacity: 1; }
  }
</style>
</head>
<body>
  <section class="how" aria-labelledby="how-title">
    <span class="tag">Your first steps</span>
    <h2 id="how-title">How therapy works at MindCare</h2>
    <ol class="steps">
      <li class="step"><div class="dot" aria-hidden="true">1</div><h3>Get in touch</h3><p>Call or email us. We answer within one working day.</p></li>
      <li class="step"><div class="dot" aria-hidden="true">2</div><h3>First conversation</h3><p>A relaxed session to understand what you need.</p></li>
      <li class="step"><div class="dot" aria-hidden="true">3</div><h3>Your plan</h3><p>Together you agree goals and the right approach.</p></li>
      <li class="step"><div class="dot" aria-hidden="true">4</div><h3>Regular sessions</h3><p>Work towards your goals and review progress.</p></li>
    </ol>
  </section>
</body>
</html>`;

/** Starter for the hero sandbox: students replace it with ChatGPT's snippet. */
export const HERO_SANDBOX_STARTER = `<!-- 1. Delete everything in this box.
     2. Paste the code ChatGPT gave you for your animated hero.
     3. Press Run and check it on the phone size too. -->
<style>
  .hero-demo { font-family: system-ui, sans-serif; text-align: center; padding: 60px 20px;
    background: linear-gradient(135deg, #e8f2ee, #ece8fa); border-radius: 24px; }
  .hero-demo h1 { color: #0f5c6b; animation: fade-in 1s ease-out both; }
  @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .hero-demo h1 { animation: none; } }
</style>
<section class="hero-demo">
  <h1>Paste your hero code here</h1>
  <p>Then press Run.</p>
</section>`;

/** Starter for the stats / steps sandbox. */
export const SECTION_SANDBOX_STARTER = `<!-- Paste ChatGPT's "How therapy works" or "clinic in numbers" section here, then press Run. -->
<style>
  .steps-demo { font-family: system-ui, sans-serif; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; padding: 24px; }
  .steps-demo div { background: #fff; border: 2px solid #8fbfae; border-radius: 18px; padding: 18px; text-align: center; }
</style>
<div class="steps-demo">
  <div><strong>1</strong><br>Get in touch</div>
  <div><strong>2</strong><br>First conversation</div>
  <div><strong>3</strong><br>Your plan</div>
</div>`;

/**
 * "Change the AI's code" exercise: a small card ChatGPT might write, with the three values students
 * change (background colour, heading text, animation speed) marked by comments.
 */
export const EDIT_SANDBOX_STARTER = `<!-- ChatGPT wrote this card. Your job: change 3 things (see the task), then press Run. -->
<style>
  .mc-card {
    font-family: system-ui, sans-serif;
    max-width: 420px;
    margin: 40px auto;
    padding: 28px;
    border-radius: 24px;
    background: #e8f2ee;            /* CHANGE 1: background colour (a hex code) */
    color: #17323a;
    text-align: center;
    animation: mc-rise 1s ease-out both;   /* CHANGE 3: speed (1s = one second) */
  }
  .mc-card h2 { margin: 0 0 8px; color: #0f5c6b; }
  .mc-card p { margin: 0; line-height: 1.6; }
  @keyframes mc-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .mc-card { animation: none; } }
</style>
<div class="mc-card">
  <h2>You are not alone</h2>   <!-- CHANGE 2: the heading text -->
  <p>Talking to a psychologist is a sign of strength. We are here to listen.</p>
</div>`;
