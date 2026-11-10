/**
 * Color themes. A theme uses the same format as a VS Code color theme (workbench `colors` + TextMate `tokenColors`),
 * so theme extensions from Open VSX can be installed. Workbench colors apply fully; syntax colors are mapped from
 * TextMate scopes onto Monaco's token names, which is close but not identical to VS Code.
 */
import * as monaco from 'monaco-editor';
import { Emitter } from './dom';
import { settings } from './settings';

export type TokenColor = { scope?: string | string[]; settings: { foreground?: string; fontStyle?: string } };
export type Theme = { name: string; type: 'dark' | 'light' | 'hc'; colors: Record<string, string>; tokenColors: TokenColor[]; source?: string };

const DARK: Theme = {
  name: 'Dark Modern', type: 'dark',
  colors: {
    'editor.background': '#1f1f1f', 'foreground': '#cccccc', 'sideBar.background': '#181818', 'activityBar.background': '#181818',
    'activityBar.foreground': '#d7d7d7', 'activityBar.inactiveForeground': '#868686', 'titleBar.activeBackground': '#181818',
    'statusBar.background': '#181818', 'statusBar.foreground': '#cccccc', 'tab.activeBackground': '#1f1f1f', 'tab.inactiveBackground': '#181818',
    'editorGroupHeader.tabsBackground': '#181818', 'panel.background': '#181818', 'panel.border': '#2b2b2b', 'input.background': '#313131',
    'focusBorder': '#0078d4', 'button.background': '#0078d4', 'button.foreground': '#ffffff', 'list.hoverBackground': '#2a2d2e',
    'list.activeSelectionBackground': '#04395e', 'list.activeSelectionForeground': '#ffffff', 'menu.background': '#1f1f1f',
    'badge.background': '#616161', 'badge.foreground': '#f8f8f8', 'descriptionForeground': '#9d9d9d', 'textLink.foreground': '#4daafc',
    'editorWidget.background': '#202020', 'activityBarBadge.background': '#0078d4',
  },
  tokenColors: [],
};
const LIGHT: Theme = {
  name: 'Light Modern', type: 'light',
  colors: {
    'editor.background': '#ffffff', 'foreground': '#3b3b3b', 'sideBar.background': '#f8f8f8', 'activityBar.background': '#f8f8f8',
    'activityBar.foreground': '#1f1f1f', 'activityBar.inactiveForeground': '#616161', 'titleBar.activeBackground': '#f8f8f8',
    'statusBar.background': '#f8f8f8', 'statusBar.foreground': '#3b3b3b', 'tab.activeBackground': '#ffffff', 'tab.inactiveBackground': '#f8f8f8',
    'editorGroupHeader.tabsBackground': '#f8f8f8', 'panel.background': '#f8f8f8', 'panel.border': '#e5e5e5', 'input.background': '#ffffff',
    'input.border': '#cecece', 'focusBorder': '#005fb8', 'button.background': '#005fb8', 'button.foreground': '#ffffff', 'list.hoverBackground': '#f2f2f2',
    'list.activeSelectionBackground': '#e8e8e8', 'list.activeSelectionForeground': '#000000', 'menu.background': '#ffffff',
    'badge.background': '#cccccc', 'badge.foreground': '#3b3b3b', 'descriptionForeground': '#616161', 'textLink.foreground': '#005fb8',
    'editorWidget.background': '#f8f8f8', 'activityBarBadge.background': '#005fb8',
  },
  tokenColors: [],
};
const BUENOVA: Theme = {
  name: 'BUENOVA Dark', type: 'dark',
  colors: {
    'editor.background': '#0e1115', 'foreground': '#eceef1', 'sideBar.background': '#0a0c0f', 'activityBar.background': '#0a0c0f',
    'activityBar.foreground': '#c8ff4d', 'activityBar.inactiveForeground': '#8a93a2', 'titleBar.activeBackground': '#0a0c0f',
    'statusBar.background': '#0a0c0f', 'statusBar.foreground': '#aab1bd', 'tab.activeBackground': '#0e1115', 'tab.inactiveBackground': '#0a0c0f',
    'editorGroupHeader.tabsBackground': '#0a0c0f', 'panel.background': '#0a0c0f', 'panel.border': '#20252d', 'input.background': '#161a20',
    'focusBorder': '#c8ff4d', 'button.background': '#c8ff4d', 'button.foreground': '#0a0c0f', 'list.hoverBackground': '#161a20',
    'list.activeSelectionBackground': '#222a16', 'list.activeSelectionForeground': '#eceef1', 'menu.background': '#12161b',
    'badge.background': '#c8ff4d', 'badge.foreground': '#0a0c0f', 'descriptionForeground': '#8a93a2', 'textLink.foreground': '#c8ff4d',
    'editorWidget.background': '#12161b', 'activityBarBadge.background': '#c8ff4d', 'activityBarBadge.foreground': '#0a0c0f',
    'editorCursor.foreground': '#c8ff4d', 'editor.selectionBackground': '#3a4a1c', 'editorLineNumber.activeForeground': '#c8ff4d',
  },
  tokenColors: [
    { scope: 'comment', settings: { foreground: '#6b7482', fontStyle: 'italic' } },
    { scope: 'string', settings: { foreground: '#a6e22e' } },
    { scope: 'keyword', settings: { foreground: '#ff7ab2' } },
    { scope: 'constant.numeric', settings: { foreground: '#ffb86c' } },
    { scope: 'entity.name.type', settings: { foreground: '#7ad7ff' } },
    { scope: 'entity.name.tag', settings: { foreground: '#ff7ab2' } },
    { scope: 'entity.other.attribute-name', settings: { foreground: '#c8ff4d' } },
  ],
};
const HC: Theme = {
  name: 'High Contrast', type: 'hc',
  colors: {
    'editor.background': '#000000', 'foreground': '#ffffff', 'sideBar.background': '#000000', 'activityBar.background': '#000000',
    'activityBar.foreground': '#ffffff', 'activityBar.inactiveForeground': '#ffffff', 'titleBar.activeBackground': '#000000', 'statusBar.background': '#000000',
    'statusBar.foreground': '#ffffff', 'tab.activeBackground': '#000000', 'tab.inactiveBackground': '#000000', 'editorGroupHeader.tabsBackground': '#000000',
    'panel.background': '#000000', 'panel.border': '#6fc3df', 'input.background': '#000000', 'input.border': '#6fc3df', 'focusBorder': '#f38518',
    'button.background': '#000000', 'button.foreground': '#ffffff', 'list.hoverBackground': '#1a1a1a', 'list.activeSelectionBackground': '#000000',
    'list.activeSelectionForeground': '#ffffff', 'menu.background': '#000000', 'badge.background': '#000000', 'badge.foreground': '#ffffff',
    'descriptionForeground': '#ffffff', 'textLink.foreground': '#21a6ff', 'editorWidget.background': '#0c141f', 'contrastBorder': '#6fc3df',
  },
  tokenColors: [],
};

const builtIn = [DARK, LIGHT, BUENOVA, HC];
const installed = new Map<string, Theme>();
export const themesChanged = new Emitter();
export const allThemes = () => [...builtIn, ...installed.values()];
export function addTheme(t: Theme) { installed.set(t.name, t); themesChanged.emit(); }
export function removeThemes(source: string) {
  for (const [k, t] of installed) if (t.source === source) installed.delete(k);
  themesChanged.emit();
}

/** TextMate scope → Monaco token name (longest prefix wins). */
const SCOPES: [string, string][] = [
  ['comment', 'comment'], ['string.regexp', 'regexp'], ['string', 'string'], ['constant.numeric', 'number'], ['constant.language', 'constant'],
  ['constant.character.escape', 'string.escape'], ['constant', 'constant'], ['keyword.operator', 'operator'], ['keyword', 'keyword'], ['storage', 'keyword'],
  ['entity.name.type', 'type'], ['entity.name.class', 'type'], ['support.type', 'type'], ['support.class', 'type'], ['entity.name.tag', 'tag'],
  ['entity.other.attribute-name', 'attribute.name'], ['variable.parameter', 'variable.parameter'], ['variable', 'variable'], ['entity.name.function', 'function'],
  ['support.function', 'function'], ['punctuation.definition.tag', 'delimiter'], ['meta.tag', 'metatag'], ['markup.heading', 'keyword'], ['markup.bold', 'strong'],
  ['markup.italic', 'emphasis'], ['invalid', 'invalid'], ['support.constant', 'constant'], ['meta.property-name', 'attribute.name'], ['support.type.property-name', 'attribute.name'],
];
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const norm = (c: string) => (c.length === 4 || c.length === 5 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c);

function monacoRules(t: Theme): monaco.editor.ITokenThemeRule[] {
  const rules = new Map<string, monaco.editor.ITokenThemeRule>();
  for (const tc of t.tokenColors) {
    const scopes = (Array.isArray(tc.scope) ? tc.scope : (tc.scope ?? '').split(',')).map((s) => s.trim()).filter(Boolean);
    const fg = tc.settings?.foreground && HEX.test(tc.settings.foreground) ? norm(tc.settings.foreground).slice(1, 7) : undefined;
    for (const scope of scopes) {
      const hit = SCOPES.filter(([p]) => scope === p || scope.startsWith(p + '.') || p.startsWith(scope + '.') && scope.split('.').length >= 1 && scope === p.split('.').slice(0, scope.split('.').length).join('.'))
        .sort((a, b) => b[0].length - a[0].length);
      for (const [p, token] of hit) {
        // an exact or more specific theme scope beats a broader one already recorded
        const prev = rules.get(token) as (monaco.editor.ITokenThemeRule & { w?: number }) | undefined;
        const w = scope.length >= p.length ? 1000 - (scope.length - p.length) : scope.length;
        if (prev && (prev.w ?? 0) >= w) continue;
        rules.set(token, { token, foreground: fg, fontStyle: tc.settings?.fontStyle || undefined, w } as monaco.editor.ITokenThemeRule);
      }
    }
  }
  return [...rules.values()].map(({ token, foreground, fontStyle }) => ({ token, ...(foreground ? { foreground } : {}), ...(fontStyle ? { fontStyle } : {}) }));
}

const pick = (t: Theme, keys: string[], fallback: string) => { for (const k of keys) { const v = t.colors[k]; if (v && HEX.test(v)) return v; } return fallback; };

export function applyTheme(name?: string) {
  const want = name ?? settings.get<string>('workbench.colorTheme');
  const t = allThemes().find((x) => x.name === want) ?? DARK;
  const dark = t.type !== 'light';
  const colors = Object.fromEntries(Object.entries(t.colors).filter(([, v]) => typeof v === 'string' && HEX.test(v)).map(([k, v]) => [k, norm(v)]));
  monaco.editor.defineTheme('ide-theme', { base: t.type === 'light' ? 'vs' : t.type === 'hc' ? 'hc-black' : 'vs-dark', inherit: true, rules: monacoRules(t), colors });
  monaco.editor.setTheme('ide-theme');

  const bg = pick(t, ['editor.background'], dark ? '#1f1f1f' : '#ffffff');
  const fg = pick(t, ['foreground', 'editor.foreground'], dark ? '#cccccc' : '#3b3b3b');
  const side = pick(t, ['sideBar.background'], bg);
  const border = pick(t, ['panel.border', 'sideBar.border', 'editorGroup.border', 'contrastBorder'], dark ? '#2b2b2b' : '#e5e5e5');
  const vars: Record<string, string> = {
    '--ide-bg': bg, '--ide-fg': fg, '--ide-side-bg': side, '--ide-side-fg': pick(t, ['sideBar.foreground'], fg),
    '--ide-activity-bg': pick(t, ['activityBar.background'], side), '--ide-activity-fg': pick(t, ['activityBar.foreground'], fg),
    '--ide-activity-dim': pick(t, ['activityBar.inactiveForeground'], dark ? '#868686' : '#616161'),
    '--ide-title-bg': pick(t, ['titleBar.activeBackground'], side), '--ide-title-fg': pick(t, ['titleBar.activeForeground'], fg),
    '--ide-status-bg': pick(t, ['statusBar.background'], side), '--ide-status-fg': pick(t, ['statusBar.foreground'], fg),
    '--ide-tabs-bg': pick(t, ['editorGroupHeader.tabsBackground'], side), '--ide-tab-on-bg': pick(t, ['tab.activeBackground'], bg),
    '--ide-tab-off-bg': pick(t, ['tab.inactiveBackground'], side), '--ide-tab-on-fg': pick(t, ['tab.activeForeground'], fg),
    '--ide-tab-off-fg': pick(t, ['tab.inactiveForeground', 'descriptionForeground'], dark ? '#9d9d9d' : '#616161'),
    '--ide-border': border, '--ide-panel-bg': pick(t, ['panel.background'], side),
    '--ide-input-bg': pick(t, ['input.background'], dark ? '#313131' : '#ffffff'), '--ide-input-fg': pick(t, ['input.foreground'], fg),
    '--ide-input-border': pick(t, ['input.border'], border), '--ide-focus': pick(t, ['focusBorder'], '#0078d4'),
    '--ide-button-bg': pick(t, ['button.background'], '#0078d4'), '--ide-button-fg': pick(t, ['button.foreground'], '#ffffff'),
    '--ide-hover': pick(t, ['list.hoverBackground'], dark ? '#2a2d2e' : '#f2f2f2'),
    '--ide-sel-bg': pick(t, ['list.activeSelectionBackground'], dark ? '#04395e' : '#e8e8e8'),
    '--ide-sel-fg': pick(t, ['list.activeSelectionForeground'], dark ? '#ffffff' : '#000000'),
    '--ide-menu-bg': pick(t, ['menu.background', 'dropdown.background', 'editorWidget.background'], dark ? '#1f1f1f' : '#ffffff'),
    '--ide-menu-fg': pick(t, ['menu.foreground'], fg), '--ide-badge-bg': pick(t, ['activityBarBadge.background', 'badge.background'], '#0078d4'),
    '--ide-badge-fg': pick(t, ['activityBarBadge.foreground', 'badge.foreground'], '#ffffff'),
    '--ide-dim': pick(t, ['descriptionForeground'], dark ? '#9d9d9d' : '#616161'), '--ide-link': pick(t, ['textLink.foreground'], '#4daafc'),
    '--ide-widget-bg': pick(t, ['editorWidget.background'], side), '--ide-error': pick(t, ['errorForeground', 'editorError.foreground'], dark ? '#f14c4c' : '#e51400'),
    '--ide-warning': pick(t, ['editorWarning.foreground'], dark ? '#cca700' : '#bf8803'),
    '--ide-term-bg': pick(t, ['terminal.background', 'panel.background'], side), '--ide-term-fg': pick(t, ['terminal.foreground'], fg),
  };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.ideTheme = t.type;
  root.style.colorScheme = dark ? 'dark' : 'light';
  current = t;
  themeApplied.emit(t);
}
let current: Theme = DARK;
export const currentTheme = () => current;
export const themeApplied = new Emitter<Theme>();
