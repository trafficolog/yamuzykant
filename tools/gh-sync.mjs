#!/usr/bin/env node
// gh-sync — синхронизация карточек с GitHub через gh CLI. По умолчанию dry-run.
//   node tools/gh-sync.mjs                 показать, что будет создано
//   node tools/gh-sync.mjs --apply         метки, вехи, issue; номера issue пишутся в карточки
//   node tools/gh-sync.mjs --close-done --apply   закрыть issue задач в статусе done
//   node tools/gh-sync.mjs --protection --apply   защита main (после задачи 0.1.3)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'inherit'] }).trim();
const run = (desc, args, input) => { console.log((APPLY ? '+ ' : '~ ') + desc); return APPLY ? gh(args, input) : ''; };
const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);

const parse = text => { const m = text.match(/^---\n([\s\S]*?)\n---/); const o = {}; for (const l of m[1].split('\n')) { const k = l.match(/^(\w+):\s*(.*)$/); if (!k) continue; let v = k[2].trim(); if (v.startsWith('[')) v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean); else if (v === 'null') v = null; else v = v.replace(/^"|"$/g, ''); o[k[1]] = v; } return o; };
const tasks = readdirSync('docs/tasks').filter(f => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map(f => { const file = `docs/tasks/${f}`; const text = readFileSync(file, 'utf8'); return { file, text, fm: parse(text) }; });

if (process.argv.includes('--protection')) {
  const body = JSON.stringify({
    required_status_checks: { strict: true, contexts: ['docs', 'php', 'js', 'e2e'] },
    enforce_admins: false,
    required_pull_request_reviews: { required_approving_review_count: Number(process.env.REQUIRED_APPROVALS ?? 0) },
    restrictions: null, required_linear_history: true, allow_force_pushes: false, allow_deletions: false
  });
  run(`защита main в ${repo}`, ['api', '-X', 'PUT', `repos/${repo}/branches/main/protection`, '--input', '-'], body);
  process.exit(0);
}

// метки
const LABELS = [
  ...['0', '1', '2', '3', '4', '5', '6'].map(p => [`phase:${p}`, '6E7781']),
  ...['G0', 'G1', 'G2', 'G3'].map(g => [`gate:${g}`, '0E8A16']),
  ...['BACK', 'FRONT', 'DB', 'DEVOPS', 'SEC', 'QA'].map(r => [`role:${r}`, '1D76DB']),
  ['risk:low', 'C2E0C6'], ['risk:medium', 'FBCA04'], ['risk:high', 'D93F0B'],
  ['model:opus', '5319E7'], ['model:sonnet', '0052CC'], ['model:haiku', 'BFDADC'],
  ['status:in_progress', 'FEF2C0'], ['status:review', 'C5DEF5'], ['status:blocked', 'B60205'], ['status:question', 'E99695'],
  ['task', 'EDEDED'], ['bug', 'D73A4A']
];
const existingLabels = new Set(JSON.parse(gh(['label', 'list', '--limit', '200', '--json', 'name'])).map(l => l.name));
for (const [name, color] of LABELS) if (!existingLabels.has(name)) run(`метка ${name}`, ['label', 'create', name, '--color', color]);

// вехи
const MILESTONES = { G0: 'G0 Фундамент', G1: 'G1 Альфа', G2: 'G2 Бета', G3: 'G3 Запуск R1' };
const ms = JSON.parse(gh(['api', `repos/${repo}/milestones?state=all&per_page=100`]));
for (const title of Object.values(MILESTONES)) if (!ms.find(m => m.title === title)) run(`веха ${title}`, ['api', `repos/${repo}/milestones`, '-f', `title=${title}`]);

// issue
let created = 0;
for (const t of tasks) {
  const fm = t.fm;
  if (process.argv.includes('--close-done')) {
    if (fm.status === 'done' && fm.issue) run(`закрыть #${fm.issue} (${fm.id})`, ['issue', 'close', String(fm.issue), '--reason', 'completed']);
    continue;
  }
  if (fm.issue || fm.status === 'done' || fm.status === 'cancelled') continue;
  const labels = ['task', `phase:${fm.phase}`, `gate:${fm.gate}`, `risk:${fm.risk}`, `model:${fm.model_impl}`, ...fm.roles.map(r => `role:${r}`)].join(',');
  const body = `Карточка: \`${t.file}\`\n\nИсполнитель: **${fm.model_impl}** · Ревьюер: **${fm.model_review}** · Зависит от: ${fm.depends_on.join(', ') || '—'}\n\n---\n\n${t.text.replace(/^---[\s\S]*?---\n/, '')}`;
  const url = run(`issue ${fm.id} ${fm.title}`, ['issue', 'create', '--title', `${fm.id} ${fm.title}`, '--body-file', '-', '--label', labels, '--milestone', MILESTONES[fm.gate]], body);
  if (APPLY) {
    const num = url.split('/').pop();
    writeFileSync(t.file, t.text.replace(/^issue:.*$/m, `issue: ${num}`));
  }
  created++;
}
console.log(`${APPLY ? 'создано' : 'будет создано'} issue: ${created}. Репозиторий: ${repo}`);
