#!/usr/bin/env node
// docs-ops — без зависимостей. Команды:
//   check [--pr <num>]   структура карточек, зависимости, гейты; с --pr — наличие вердикта ревью в PR
//   refresh              автоблоки эпиков и фаз, docs/operations/status/{ROLLUP,NEXT}.md
//   next [--json]        задачи, которые можно брать: зависимости done, гейт open
//   set <id> <status>    сменить статус карточки (и sync_state=aligned при done)
//   session <id>         создать файл сессии из шаблона
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const D = 'docs';
const STATUS = ['todo', 'ready', 'in_progress', 'review', 'done', 'blocked', 'cancelled'];
const GATES = ['G0', 'G1', 'G2', 'G3'];
const MODELS = ['opus', 'sonnet', 'haiku'];
const RISKS = ['low', 'medium', 'high'];
const RANK = { haiku: 0, sonnet: 1, opus: 2 };

function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const o = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([\w_]+):\s*(.*)$/);
    if (!k) continue;
    let v = k[2].trim();
    if (v.startsWith('[')) v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (v === 'null') v = null;
    else v = v.replace(/^["']|["']$/g, '');
    o[k[1]] = v;
  }
  return o;
}
function setField(text, key, value) {
  const re = new RegExp(`^(${key}:).*$`, 'm');
  return re.test(text) ? text.replace(re, `$1 ${value}`) : text.replace(/^---\n/, `---\n${key}: ${value}\n`);
}
const load = dir => existsSync(join(D, dir))
  ? readdirSync(join(D, dir)).filter(f => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(f => { const file = join(D, dir, f); const text = readFileSync(file, 'utf8'); return { f, file, text, fm: parse(text) }; })
  : [];
const block = (text, name, body) => text.replace(new RegExp(`<!-- docs:ops:begin ${name} -->[\\s\\S]*?<!-- docs:ops:end -->`), `<!-- docs:ops:begin ${name} -->\n${body}\n<!-- docs:ops:end -->`);

const phases = load('phases'), epics = load('epics'), tasks = load('tasks'), gates = load('operations/gates');
const byId = Object.fromEntries(tasks.map(t => [t.fm?.id, t]));
const gateStatus = g => gates.find(x => x.fm?.id === g)?.fm?.status ?? 'locked';
const openGate = () => GATES.find(g => gateStatus(g) !== 'signed');

// resources/js/ds — генерируемая копия ДС: меняется только PR «chore(ds): sync».
export function checkDsPr(files, title) {
  const touchesDs = files.some(f => f.replaceAll('\\', '/').startsWith('resources/js/ds/'));
  if (touchesDs && !String(title).startsWith('chore(ds): sync')) return 'resources/js/ds меняется только через npm run ds:sync (PR chore(ds): sync)';
  return null;
}

function check(pr) {
  const errs = [], ids = new Set();
  for (const d of [...phases, ...epics, ...tasks]) {
    if (!d.fm) { errs.push(`${d.file}: нет frontmatter`); continue; }
    for (const k of ['id', 'title', 'status']) if (!d.fm[k]) errs.push(`${d.file}: нет поля ${k}`);
    if (ids.has(d.fm.id)) errs.push(`${d.file}: дубль id ${d.fm.id}`);
    ids.add(d.fm.id);
    if (!STATUS.includes(d.fm.status)) errs.push(`${d.file}: недопустимый статус «${d.fm.status}»`);
  }
  const pIds = new Set(phases.map(p => p.fm?.id)), eIds = new Set(epics.map(e => e.fm?.id));
  for (const e of epics) if (e.fm && !pIds.has(e.fm.phase)) errs.push(`${e.file}: нет фазы ${e.fm.phase}`);
  for (const t of tasks) {
    const fm = t.fm; if (!fm) continue;
    if (!eIds.has(fm.epic)) errs.push(`${t.file}: нет эпика ${fm.epic}`);
    if (!GATES.includes(fm.gate)) errs.push(`${t.file}: gate «${fm.gate}»`);
    if (!RISKS.includes(fm.risk)) errs.push(`${t.file}: risk «${fm.risk}»`);
    if (!MODELS.includes(fm.model_impl) || !MODELS.includes(fm.model_review)) errs.push(`${t.file}: model_impl/model_review`);
    else if (fm.risk !== 'low' && RANK[fm.model_review] < RANK[fm.model_impl]) errs.push(`${t.file}: ревьюер ниже исполнителя`);
    if (fm.risk === 'high' && fm.model_review !== 'opus') errs.push(`${t.file}: risk high требует model_review: opus`);
    for (const dep of fm.depends_on || []) {
      const d = byId[dep];
      if (!d) errs.push(`${t.file}: зависимость ${dep} не найдена`);
      else if (GATES.indexOf(d.fm.gate) > GATES.indexOf(fm.gate)) errs.push(`${t.file}: зависит от ${dep} из более позднего гейта ${d.fm.gate}`);
    }
    if (fm.status === 'done' && fm.sync_state !== 'aligned') errs.push(`${t.file}: done, но sync_state не aligned`);
    for (const s of ['## Цель', '## Критерии приёмки', '## Тесты']) if (!t.text.includes(s)) errs.push(`${t.file}: нет раздела «${s}»`);
  }
  // циклы
  const seen = {}, stack = {};
  const dfs = id => { if (stack[id]) { errs.push(`цикл зависимостей через ${id}`); return; } if (seen[id]) return; seen[id] = stack[id] = 1; for (const d of byId[id]?.fm?.depends_on || []) dfs(d); stack[id] = 0; };
  Object.keys(byId).forEach(dfs);
  if (pr) {
    try {
      const body = execFileSync('gh', ['pr', 'view', String(pr), '--json', 'comments,reviews', '-q', '[.comments[].body, .reviews[].body] | join("\\n")'], { encoding: 'utf8' });
      if (!/REVIEW:\s*approve/i.test(body)) errs.push(`PR #${pr}: нет вердикта «REVIEW: approve»`);
    } catch { errs.push(`PR #${pr}: не удалось прочитать через gh`); }
    try {
      const info = JSON.parse(execFileSync('gh', ['pr', 'view', String(pr), '--json', 'files,title'], { encoding: 'utf8' }));
      const dsErr = checkDsPr((info.files || []).map(f => f.path), info.title);
      if (dsErr) errs.push(`PR #${pr}: ${dsErr}`);
    } catch { errs.push(`PR #${pr}: не удалось получить файлы через gh`); }
  }
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`ok: фаз ${phases.length}, эпиков ${epics.length}, задач ${tasks.length}, открыт гейт ${openGate() ?? '—'}`);
}

function eligible() {
  const g = openGate();
  return tasks.filter(t => ['todo', 'ready'].includes(t.fm.status) && t.fm.gate === g
    && (t.fm.depends_on || []).every(d => byId[d]?.fm.status === 'done'));
}

function refresh() {
  const of = e => tasks.filter(t => t.fm?.epic === e.fm?.id);
  const roll = ts => !ts.length ? 'todo' : ts.every(t => ['done', 'cancelled'].includes(t.fm.status)) ? 'done' : ts.some(t => t.fm.status !== 'todo' && t.fm.status !== 'ready') ? 'in_progress' : 'todo';
  for (const e of epics) {
    const ts = of(e);
    const body = '| Задача | Статус | Риск | Исполнитель → Ревьюер |\n|---|---|---|---|\n' + ts.map(t => `| [${t.fm.id} ${t.fm.title}](../tasks/${t.f}) | ${t.fm.status} | ${t.fm.risk} | ${t.fm.model_impl} → ${t.fm.model_review} |`).join('\n');
    writeFileSync(e.file, setField(block(e.text, 'tasks', body), 'status', roll(ts)));
  }
  for (const p of phases) {
    const es = epics.filter(e => e.fm?.phase === p.fm?.id);
    const body = '| Эпик | Задач | Готово |\n|---|---|---|\n' + es.map(e => `| [${e.fm.id} ${e.fm.title}](../epics/${e.f}) | ${of(e).length} | ${of(e).filter(t => t.fm.status === 'done').length} |`).join('\n');
    const all = es.flatMap(of);
    writeFileSync(p.file, setField(block(p.text, 'epics', body), 'status', roll(all)));
  }
  mkdirSync(join(D, 'operations/status'), { recursive: true });
  const n = s => tasks.filter(t => t.fm.status === s).length;
  writeFileSync(join(D, 'operations/status/ROLLUP.md'), `<!-- AUTO-GENERATED by tools/docs-ops.mjs — не редактировать -->\n# Сводка\n\nЗадач: ${tasks.length} · done ${n('done')} · in_progress ${n('in_progress')} · review ${n('review')} · blocked ${n('blocked')} · открыт гейт: ${openGate() ?? 'все подписаны'}\n\n| Задача | Гейт | Статус | Риск | Исполнитель → Ревьюер | Issue |\n|---|---|---|---|---|---|\n${tasks.map(t => `| ${t.fm.id} ${t.fm.title} | ${t.fm.gate} | ${t.fm.status} | ${t.fm.risk} | ${t.fm.model_impl} → ${t.fm.model_review} | ${t.fm.issue ? '#' + t.fm.issue : '—'} |`).join('\n')}\n`);
  writeFileSync(join(D, 'operations/status/NEXT.md'), `<!-- AUTO-GENERATED -->\n# Можно брать в работу (гейт ${openGate()})\n\n${eligible().map(t => `- ${t.fm.id} ${t.fm.title} — ${t.fm.model_impl} → ${t.fm.model_review}, risk ${t.fm.risk}`).join('\n') || '_Нет задач: проверьте блокеры или проведите гейт._'}\n`);
  console.log('refreshed');
}

function setStatus(id, status) {
  const t = byId[id]; if (!t) throw new Error(`нет задачи ${id}`);
  if (!STATUS.includes(status)) throw new Error(`статус ${status}`);
  let text = setField(t.text, 'status', status);
  if (status === 'done') text = setField(text, 'sync_state', 'aligned');
  writeFileSync(t.file, text);
  console.log(`${id}: ${status}`);
}

function session(id) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(D, 'operations/sessions'); mkdirSync(dir, { recursive: true });
  const out = join(dir, `${date}-${id}.md`);
  writeFileSync(out, readFileSync(join(D, 'operations/templates/session.md'), 'utf8').replaceAll('YYYY-MM-DD', date).replaceAll('N.M.K', id));
  console.log(out);
}

function main() {
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'check') check(a === '--pr' ? b : null);
else if (cmd === 'refresh') refresh();
else if (cmd === 'next') { const e = eligible(); console.log(a === '--json' ? JSON.stringify(e.map(t => ({ id: t.fm.id, title: t.fm.title, file: t.file, risk: t.fm.risk, model_impl: t.fm.model_impl, model_review: t.fm.model_review, issue: t.fm.issue }))) : e.map(t => `${t.fm.id}\t${t.fm.model_impl}→${t.fm.model_review}\t${t.fm.title}`).join('\n') || '—'); }
else if (cmd === 'set' && a && b) setStatus(a, b);
else if (cmd === 'session' && a) session(a);
else { console.log('check [--pr N] | refresh | next [--json] | set <id> <status> | session <id>'); process.exit(1); }
}
// Запуск из CLI; при импорте (тесты) команды не выполняются.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
