#!/usr/bin/env bash
# Runs INSIDE the Docker build box (node:22-bookworm): gets one student's Expo app, makes a real web build of it
# with Expo's own bundler, and writes it to /out/dist plus /out/build.json. Student code (npm scripts, babel /
# metro / tailwind configs) only ever runs in here: the host mounts nothing but /out (and /src read-only for an
# app that came inside a ZIP).
#   REPO=owner/name   clone https://github.com/owner/name (default branch), or
#   /src              a folder with the app files (from the hand-in ZIP)
#   BASE=/preview/<key>   the path the site serves the build from
set -uo pipefail
export CI=1 EXPO_NO_TELEMETRY=1 EXPO_NO_GIT_STATUS=1 NPM_CONFIG_UPDATE_NOTIFIER=false npm_config_fund=false npm_config_audit=false
mkdir -p /out
# the box runs as root, so everything it writes in /out is root's: hand it back to the user who started the build
# (HOST_UID / HOST_GID), on every exit, or the builder cannot delete its own work folder afterwards (EACCES)
give_back() { [ -n "${HOST_UID:-}" ] && chown -R "${HOST_UID}:${HOST_GID:-$HOST_UID}" /out 2>/dev/null; chmod -R u+rwX,go+rX /out 2>/dev/null; true; }
trap give_back EXIT
fail() { node -e 'const fs=require("fs");fs.writeFileSync("/out/build.json",JSON.stringify({ok:false,error:process.argv[1],sha:process.env.SHA||null,root:process.env.ROOT||null,sdk:process.env.SDK||null}))' "$1"; echo "BUILD FAILED: $1"; exit 1; }

cd /work || exit 1
if [ -n "${REPO:-}" ]; then
  git clone --depth 1 --quiet "https://github.com/${REPO}.git" src 2>/out/clone.log || { sleep 5; rm -rf src; git clone --depth 1 --quiet "https://github.com/${REPO}.git" src 2>>/out/clone.log; } || fail "Could not clone github.com/${REPO} (private, renamed or deleted?)"
  SHA=$(git -C src rev-parse HEAD); export SHA
else
  [ -d /src ] || fail "No source: give REPO or mount /src"
  cp -r /src src
fi

# the Expo app: the shallowest folder whose package.json depends on expo (node_modules skipped)
ROOT=$(cd src && find . -name package.json -not -path '*/node_modules/*' -printf '%d %p\n' | sort -n | while read -r _ p; do
  if node -e 'const p=require(require("path").resolve(process.argv[1]));process.exit(((p.dependencies||{}).expo||(p.devDependencies||{}).expo)?0:1)' "$p"; then dirname "$p"; break; fi
done)
[ -n "$ROOT" ] || fail "No Expo app found (no package.json that depends on expo)"
export ROOT
cd "src/$ROOT" || fail "Cannot open $ROOT"
SDK=$(node -e 'const p=require("./package.json");console.log(String((p.dependencies||{}).expo||"").replace(/[^0-9.]/g,""))'); export SDK
echo "app at $ROOT, expo $SDK, base ${BASE}"

# serve from BASE as a single-page app (no server rewrites on the site)
node - <<'EOF'
const fs = require('fs');
const base = process.env.BASE;
const patch = (c) => ({ ...c, experiments: { ...(c.experiments || {}), baseUrl: base }, web: { ...(c.web || {}), output: 'single', bundler: 'metro' } });
if (fs.existsSync('app.json')) {
  const j = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  if (j.expo) j.expo = patch(j.expo); else Object.assign(j, patch(j));
  fs.writeFileSync('app.json', JSON.stringify(j, null, 2));
}
for (const f of ['app.config.js', 'app.config.ts', 'app.config.cjs', 'app.config.mjs']) {
  if (!fs.existsSync(f)) continue;
  fs.renameSync(f, f.replace('app.config', 'app.config.student'));
  fs.writeFileSync('app.config.js', `// wraps the student's config: serve the web build from the preview path
const BASE = ${JSON.stringify(base)};
module.exports = (ctx) => {
  let c = require('./${f.replace('app.config', 'app.config.student')}');
  c = c && c.default ? c.default : c;
  const out = typeof c === 'function' ? c(ctx) : { ...ctx.config, ...c };
  const e = out.expo || out;
  const patched = { ...e, experiments: { ...(e.experiments || {}), baseUrl: BASE }, web: { ...(e.web || {}), output: 'single', bundler: 'metro' } };
  return out.expo ? { ...out, expo: patched } : patched;
};
`);
  break;
}
EOF

# install exactly what the app declares (lockfile when there is one), then the three web packages if missing
if [ -f package-lock.json ]; then npm ci --loglevel=error >/out/install.log 2>&1 || npm install --loglevel=error --legacy-peer-deps >>/out/install.log 2>&1 || fail "npm install failed (see install.log)"
else npm install --loglevel=error --legacy-peer-deps >/out/install.log 2>&1 || fail "npm install failed (see install.log)"; fi
MISSING=$(node -e 'const p=require("./package.json");const d={...p.dependencies,...p.devDependencies};console.log(["react-dom","react-native-web","@expo/metro-runtime"].filter(x=>!d[x]).join(" "))')
if [ -n "$MISSING" ]; then npx --yes expo install $MISSING >>/out/install.log 2>&1 || npm install --legacy-peer-deps $MISSING >>/out/install.log 2>&1; fi

# expo-sqlite on web loads a .wasm file: the bundler must treat .wasm as an asset (Expo's documented web setup)
if [ -d node_modules/expo-sqlite ]; then
  node - <<'EOF'
const fs = require('fs');
const add = `config.resolver.assetExts = [...new Set([...(config.resolver.assetExts || []), 'wasm'])];`;
if (fs.existsSync('metro.config.js')) {
  fs.renameSync('metro.config.js', 'metro.config.student.js');
  fs.writeFileSync('metro.config.js', `// wraps the student's metro config: .wasm as an asset (expo-sqlite on web)
const student = require('./metro.config.student.js');
const wrap = (config) => { ${add} return config; };
module.exports = typeof student?.then === 'function' ? student.then(wrap) : wrap(student);
`);
} else {
  fs.writeFileSync('metro.config.js', `// added by the preview builder: .wasm as an asset (expo-sqlite on web)
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
${add}
module.exports = config;
`);
}
EOF
fi

npx expo export --platform web --output-dir /out/dist >/out/export.log 2>&1 || fail "expo export failed (see export.log)"
[ -f /out/dist/index.html ] || fail "The web build has no index.html"
node -e 'require("fs").writeFileSync("/out/build.json",JSON.stringify({ok:true,sha:process.env.SHA||null,root:process.env.ROOT,sdk:process.env.SDK}))'
echo "BUILD OK"
