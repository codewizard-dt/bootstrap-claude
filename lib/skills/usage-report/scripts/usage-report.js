#!/usr/bin/env node
'use strict';

/**
 * usage-report.js — offline token/cost rollup over Claude Code session transcripts
 *
 * Purpose: parses ~/.claude/projects/<encoded-cwd>/**\/*.jsonl (main sessions and
 *   <session-id>/subagents/agent-*.jsonl) and prints ONE JSON document on stdout:
 *   token and estimated-cost totals per model, per skill, and per day. No network,
 *   no writes outside stdout; rendering a human summary is the SKILL.md's job.
 * Usage: node usage-report.js [--project <path>] [--all-projects]
 *          [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--pretty]
 *   Default scope is process.cwd(). Unknown flag, missing flag value, or bad date
 *   exits 2 with usage on stderr. No transcripts at all is NOT an error: valid
 *   zero-total JSON, exit 0.
 * Env (tests): USAGE_REPORT_PROJECTS_DIR overrides ~/.claude/projects;
 *   USAGE_REPORT_SKILLS_DIR overrides ~/.claude/skills (declaredModel lookup).
 * Counting rules: only type:"assistant" entries with message.usage count;
 *   "<synthetic>" models and unparseable lines are skipped (the latter counted in
 *   meta.skippedLines). Streaming writes one API response several times, and fork
 *   context copies it across files, so records are deduped GLOBALLY on
 *   message.id|requestId (fallback message.id; neither -> once per file:line).
 * Attribution: a turn belongs to the most recently invoked skill in its session
 *   timeline (Skill tool_use or <command-name>/x</command-name> user string) until
 *   the next invocation; before any invocation -> "(none)". Subagent files map to
 *   the PARENT session (the directory name above subagents/). This is a heuristic.
 * Cost: tokens x pricing.json (USD per million tokens, longest model-id prefix
 *   wins). A model with no price entry has cost null and is listed in
 *   meta.unpricedModels. A byModel/bySkill/byDay row's cost is null only when every
 *   turn in it is unpriced; totals.cost sums priced turns only.
 *
 * JSON contract (schemaVersion 1 — bump on any breaking change; TASK-0109 reads it):
 *   { schemaVersion, generatedAt,
 *     scope:{project,encodedDir,allProjects}   // project/encodedDir null when allProjects
 *     range:{since,until},                     // ISO strings or null; until is end-of-day
 *     totals:{input,output,cacheCreation,cacheRead,cost,turns},
 *     byModel:[{model,tier,input,output,cacheCreation,cacheRead,cost,turns}],
 *     bySkill:[{skill,declaredModel,declaredFamily,modelCheck,models:{<model>:turns},
 *               input,output,cacheCreation,cacheRead,cost,turns}],
 *       // declaredFamily: haiku|sonnet|opus|fable|unknown|null (null = none/"inherit").
 *       // modelCheck: match|mismatch|undeclared|unknown — compares FAMILIES, not
 *       // exact ids; mismatch only when a known observed family differs. Additive
 *       // (still schemaVersion 1); consumers display it rather than re-comparing.
 *     byDay:[{date,cost,turns}],
 *     meta:{files,skippedLines,unpricedModels,pricingAsOf,attribution} }
 *   byModel/bySkill sort by cost desc (null last); byDay by date asc.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');

const NONE_SKILL = '(none)';
const USAGE = 'usage: node usage-report.js [--project <path>] [--all-projects] ' +
  '[--since YYYY-MM-DD] [--until YYYY-MM-DD] [--pretty]\n';

function encodeProjectDir(absPath) {
  return absPath.replace(/[^A-Za-z0-9]/g, '-');
}

function projectsRoot() {
  return process.env.USAGE_REPORT_PROJECTS_DIR || path.join(os.homedir(), '.claude', 'projects');
}

function skillsRoot() {
  return process.env.USAGE_REPORT_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills');
}

function listTranscripts(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'tool-results') walk(full);
      } else if (e.isFile() && e.name.endsWith('.jsonl')) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort();
}

function sessionForFile(file) {
  const parent = path.dirname(file);
  if (path.basename(parent) === 'subagents') return path.basename(path.dirname(parent));
  return path.basename(file, '.jsonl');
}

function num(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

const SLASH_RE = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/;

async function parseTranscript(file) {
  const session = sessionForFile(file);
  const isSubagent = path.basename(path.dirname(file)) === 'subagents';
  const records = [];
  const events = [];
  let skipped = 0;
  let lineNo = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const raw of rl) {
    lineNo++;
    const text = raw.trim();
    if (!text) continue;
    let entry;
    try {
      entry = JSON.parse(text);
    } catch (_) {
      skipped++;
      continue;
    }
    if (!entry || typeof entry !== 'object') {
      skipped++;
      continue;
    }
    const message = entry.message && typeof entry.message === 'object' ? entry.message : null;
    if (!message) continue;

    if (entry.type === 'assistant') {
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block && block.type === 'tool_use' && block.name === 'Skill' &&
              block.input && typeof block.input.skill === 'string' && block.input.skill) {
            events.push({
              session, ts: entry.timestamp, skill: block.input.skill.replace(/^\//, ''),
              key: block.id ? `tu:${block.id}` : null,
            });
          }
        }
      }
      const usage = message.usage;
      if (usage && typeof usage === 'object' && message.model !== '<synthetic>') {
        const cc = usage.cache_creation && typeof usage.cache_creation === 'object' ? usage.cache_creation : null;
        const cacheCreation = num(usage.cache_creation_input_tokens);
        records.push({
          file, line: lineNo, session, isSubagent,
          id: typeof message.id === 'string' ? message.id : null,
          requestId: typeof entry.requestId === 'string' ? entry.requestId : null,
          model: typeof message.model === 'string' ? message.model : 'unknown',
          ts: typeof entry.timestamp === 'string' ? entry.timestamp : null,
          input: num(usage.input_tokens),
          output: num(usage.output_tokens),
          cacheCreation,
          cacheCreation1h: cc ? Math.min(num(cc.ephemeral_1h_input_tokens), cacheCreation) : 0,
          cacheRead: num(usage.cache_read_input_tokens),
        });
      }
    } else if (entry.type === 'user' && typeof message.content === 'string') {
      const m = SLASH_RE.exec(message.content);
      if (m) {
        events.push({
          session, ts: entry.timestamp, skill: m[1],
          key: entry.uuid ? `uu:${entry.uuid}` : null,
        });
      }
    }
  }
  return { file, records, events, skipped };
}

function dedupe(records) {
  const seen = new Map();
  for (const r of records) {
    let key;
    if (r.id && r.requestId) key = `${r.id}|${r.requestId}`;
    else if (r.id) key = `id:${r.id}`;
    else key = `line:${r.file}:${r.line}`;
    seen.set(key, r);
  }
  return [...seen.values()];
}

function attributeSkills(records, events) {
  const seenKeys = new Set();
  const bySession = new Map();
  for (const ev of events) {
    if (typeof ev.ts !== 'string' || Number.isNaN(Date.parse(ev.ts))) continue;
    if (ev.key) {
      if (seenKeys.has(ev.key)) continue;
      seenKeys.add(ev.key);
    }
    if (!bySession.has(ev.session)) bySession.set(ev.session, []);
    bySession.get(ev.session).push({ t: Date.parse(ev.ts), skill: ev.skill });
  }
  for (const list of bySession.values()) list.sort((a, b) => a.t - b.t);

  return records.map((r) => {
    let skill = NONE_SKILL;
    const list = bySession.get(r.session);
    const t = r.ts ? Date.parse(r.ts) : NaN;
    if (list && !Number.isNaN(t)) {
      let lo = 0;
      let hi = list.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid].t <= t) {
          found = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (found >= 0) skill = list[found].skill;
    }
    return { ...r, skill };
  });
}

function matchPricing(model, table) {
  const keys = Object.keys(table.models || {}).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (model.startsWith(k)) return table.models[k];
  }
  return null;
}

function tierOf(model, table) {
  const p = matchPricing(model, table);
  if (p && p.tier) return p.tier;
  const m = model.toLowerCase();
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('opus')) return 'opus';
  return 'other';
}

const MODEL_FAMILIES = ['haiku', 'sonnet', 'opus', 'fable'];

// Family of a model alias or id ("sonnet", "claude-sonnet-5", "sonnet[1m]" -> "sonnet"),
// used to compare a skill's declared model to the observed ones by tier rather than
// by exact string. null = nothing to compare ("inherit", empty, non-string);
// "unknown" = a model string outside the known families (incl. "opusplan", which
// switches models mid-session).
function familyOf(model) {
  if (typeof model !== 'string') return null;
  const m = model.trim().toLowerCase();
  if (!m || m === 'inherit') return null;
  if (m.startsWith('opusplan')) return 'unknown';
  return MODEL_FAMILIES.find((f) => m.includes(f)) || 'unknown';
}

// Declared-vs-observed verdict for one skill row. "mismatch" only when the declared
// family is known and an observed model of a known, different family ran; unknown
// observed models are ignored. "undeclared" = no declared tier (missing/inherit);
// "unknown" = declared or observed families cannot be compared.
function modelCheckOf(declaredModel, observedModels) {
  const declared = familyOf(declaredModel);
  if (declared === null) return 'undeclared';
  if (declared === 'unknown') return 'unknown';
  const observed = new Set(observedModels.map(familyOf).filter((f) => f && f !== 'unknown'));
  if (observed.size === 0) return 'unknown';
  return [...observed].some((f) => f !== declared) ? 'mismatch' : 'match';
}

function price(record, table) {
  const p = matchPricing(record.model, table);
  if (!p) return null;
  const w1h = Math.min(record.cacheCreation1h || 0, record.cacheCreation);
  const w5m = record.cacheCreation - w1h;
  const rate1h = typeof p.cacheWrite1h === 'number' ? p.cacheWrite1h : p.cacheWrite;
  return (
    record.input * p.input +
    record.output * p.output +
    w5m * p.cacheWrite +
    w1h * rate1h +
    record.cacheRead * p.cacheRead
  ) / 1e6;
}

function readDeclaredModel(skill) {
  if (!/^[A-Za-z0-9_.-]+$/.test(skill) || skill === '.' || skill === '..') return null;
  let text;
  try {
    text = fs.readFileSync(path.join(skillsRoot(), skill, 'SKILL.md'), 'utf8');
  } catch (_) {
    return null;
  }
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) return null;
  const m = /^model:[ \t]*(.*?)[ \t]*$/m.exec(fm[1]);
  if (!m) return null;
  const val = m[1].replace(/^["']|["']$/g, '').trim();
  return val || null;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function newBucket() {
  return { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, cost: 0, priced: 0, turns: 0 };
}

function addTo(b, r) {
  b.input += r.input;
  b.output += r.output;
  b.cacheCreation += r.cacheCreation;
  b.cacheRead += r.cacheRead;
  b.turns += 1;
  if (typeof r.cost === 'number') {
    b.cost += r.cost;
    b.priced += 1;
  }
}

function finish(b) {
  const { priced, ...rest } = b;
  return { ...rest, cost: b.turns > 0 && priced === 0 ? null : round6(b.cost) };
}

function byCostDesc(a, b) {
  if (a.cost === null && b.cost !== null) return 1;
  if (b.cost === null && a.cost !== null) return -1;
  if (a.cost !== b.cost) return b.cost - a.cost;
  return b.turns - a.turns;
}

// Records are expected to carry `cost` (number|null), `tier`, and `skill`, as set by main().
function aggregate(records, opts = {}) {
  const declared = opts.declaredModel || readDeclaredModel;
  const totals = newBucket();
  const models = new Map();
  const skills = new Map();
  const days = new Map();

  for (const r of records) {
    addTo(totals, r);

    if (!models.has(r.model)) models.set(r.model, { tier: r.tier || 'other', b: newBucket() });
    addTo(models.get(r.model).b, r);

    const skillName = r.skill || NONE_SKILL;
    if (!skills.has(skillName)) skills.set(skillName, { b: newBucket(), models: {} });
    const s = skills.get(skillName);
    addTo(s.b, r);
    s.models[r.model] = (s.models[r.model] || 0) + 1;

    if (r.ts) {
      const date = r.ts.slice(0, 10);
      if (!days.has(date)) days.set(date, newBucket());
      addTo(days.get(date), r);
    }
  }

  const totalsOut = finish(totals);
  totalsOut.cost = round6(totals.cost);

  const byModel = [...models.entries()]
    .map(([model, v]) => ({ model, tier: v.tier, ...finish(v.b) }))
    .sort(byCostDesc);

  const bySkill = [...skills.entries()]
    .map(([skill, v]) => {
      const declaredModel = skill === NONE_SKILL ? null : declared(skill);
      return {
        skill,
        declaredModel,
        declaredFamily: familyOf(declaredModel),
        modelCheck: modelCheckOf(declaredModel, Object.keys(v.models)),
        models: v.models,
        ...finish(v.b),
      };
    })
    .sort(byCostDesc);

  const byDay = [...days.entries()]
    .map(([date, b]) => ({ date, cost: finish(b).cost, turns: b.turns }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { totals: totalsOut, byModel, bySkill, byDay };
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseArgs(argv) {
  const opts = { project: null, allProjects: false, since: null, until: null, pretty: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all-projects') opts.allProjects = true;
    else if (a === '--pretty') opts.pretty = true;
    else if (a === '--project' || a === '--since' || a === '--until') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) return { error: `missing value for ${a}` };
      i++;
      if (a === '--project') opts.project = v;
      else if (!isValidDate(v)) return { error: `${a} expects YYYY-MM-DD, got "${v}"` };
      else opts[a.slice(2)] = v;
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  return { opts };
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    process.stderr.write(`usage-report: ${parsed.error}\n${USAGE}`);
    return 2;
  }
  const opts = parsed.opts;

  let table;
  try {
    table = JSON.parse(fs.readFileSync(path.join(__dirname, 'pricing.json'), 'utf8'));
  } catch (e) {
    process.stderr.write(`usage-report: cannot load pricing.json: ${e.message}\n`);
    return 1;
  }

  const root = projectsRoot();
  let projectAbs = null;
  let encodedDir = null;
  let scanDir;
  if (opts.allProjects) {
    scanDir = root;
  } else {
    projectAbs = path.resolve(opts.project || process.cwd());
    encodedDir = encodeProjectDir(projectAbs);
    scanDir = path.join(root, encodedDir);
  }

  const files = listTranscripts(scanDir);
  let records = [];
  let events = [];
  let skippedLines = 0;
  for (const f of files) {
    const p = await parseTranscript(f);
    records = records.concat(p.records);
    events = events.concat(p.events);
    skippedLines += p.skipped;
  }

  records = dedupe(records);
  if (opts.since || opts.until) {
    records = records.filter((r) => {
      if (!r.ts) return false;
      const d = r.ts.slice(0, 10);
      return (!opts.since || d >= opts.since) && (!opts.until || d <= opts.until);
    });
  }
  records = attributeSkills(records, events).map((r) => ({
    ...r, cost: price(r, table), tier: tierOf(r.model, table),
  }));

  const agg = aggregate(records);
  const unpriced = [...new Set(records.filter((r) => r.cost === null).map((r) => r.model))].sort();

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: { project: projectAbs, encodedDir, allProjects: opts.allProjects },
    range: {
      since: opts.since ? `${opts.since}T00:00:00.000Z` : null,
      until: opts.until ? `${opts.until}T23:59:59.999Z` : null,
    },
    totals: agg.totals,
    byModel: agg.byModel,
    bySkill: agg.bySkill,
    byDay: agg.byDay,
    meta: {
      files: files.length,
      skippedLines,
      unpricedModels: unpriced,
      pricingAsOf: table.asOf,
      attribution: 'last-invoked-skill',
    },
  };

  process.stdout.write(JSON.stringify(report, null, opts.pretty ? 2 : 0) + '\n');
  return 0;
}

module.exports = {
  encodeProjectDir,
  listTranscripts,
  parseTranscript,
  dedupe,
  attributeSkills,
  price,
  tierOf,
  familyOf,
  modelCheckOf,
  aggregate,
  readDeclaredModel,
  main,
};

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (err) => {
      process.stderr.write(`usage-report: ${err && err.message ? err.message : err}\n`);
      process.exitCode = 1;
    },
  );
}
