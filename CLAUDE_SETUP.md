# Claude Code setup for App Sidequest

How to get your Claude Code set up the same way mine is, so we use the same skills and tools during the hackathon.

**Easiest way:** open this repo in Claude Code and say:

> Follow CLAUDE_SETUP.md and set up my machine.

Claude runs the installs for you and asks before each command. You still have to install the agent-skills and ponytail plugins from the Claude desktop app (end of section 2). When it's done, **restart Claude Code** so it loads the new skills.

> **For Claude, if you're following this guide:** work through section 2 in order. First check what's already installed (`git --version`, `node --version`, `bun --version`, `uv --version`, `ls ~/.claude/skills/gstack`, `graphify --help`, `claude plugin list`) and skip anything that's already there. Run `winget` commands in PowerShell and everything else in Git Bash. If a new tool isn't on PATH after `winget`, ask the user to restart the terminal or Claude Code, then continue. If a command fails, show the error and stop instead of improvising workarounds. Don't touch `~/.claude/settings.json` (section 3 is optional and up to the user). Finish by telling the user what got installed, what was skipped, and that they need to restart Claude Code.

There are two kinds of setup:

- **Comes with the repo:** you get it by pulling. Nothing to install.
- **Install on your machine:** global tools I installed outside the repo. You need to set these up yourself (once).

---

## 1. Comes with the repo (nothing to do)

After `git pull`, your Claude reads `CLAUDE.md` and `CONSTRAINTS.md` automatically. The repo has no project skills or MCP servers right now.

We removed the Motion skill, agent and MCP servers. Motion (`motion/react`) only runs on web, and the app has to build for iOS and Android too. For animation, use React Native's `Animated` or `react-native-reanimated`.

---

## 2. Install on your machine

I'm on Windows. These steps use **Git Bash** (it comes with Git for Windows) unless they say PowerShell.

### Prerequisites

Install these once (PowerShell):

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Oven-sh.Bun
winget install astral-sh.uv
```

Restart your terminal afterwards so they're on your PATH.

### gstack (skill suite: planning, review, QA, shipping)

Version I'm on: **1.99.1.0** (stable channel). I use a **trimmed "lite" install** to keep token use low during the hackathon.

In Git Bash:

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
```

```bash
cd ~/.claude/skills/gstack && ./setup --no-team --no-plan-tune-hooks --no-timeline-stop-hook --no-skill-routing --loadout lite
```

Then turn off the same heavy skills and Codex reviews I turned off:

```bash
~/.claude/skills/gstack/bin/gstack-config set disabled_skills benchmark-models,benchmark,canary,codex,cso,design-html,design-motion,design-shotgun,deslop-shared-libs,devex-review,document-generate,document-release,eval-plan,health,ios-clean,ios-design-review,ios-fix,ios-qa,ios-sync,landing-report,learn,make-pdf,modernize,open-gstack-browser,pair-agent,plan-devex-review,plan-tune,retro,runaway-stopper,scrape,setup-browser-cookies,setup-gbrain,skillify,sync-gbrain,test-audit,ubicloud,write-skill
```

```bash
~/.claude/skills/gstack/bin/gstack-config set codex_reviews disabled
```

**Updating:** on Windows gstack copies its files instead of linking them, so after any `git pull` inside `~/.claude/skills/gstack`, run `./setup` again (or just use `/gstack-upgrade`).

**Skills we actually use:**

| Command | Use it for |
|---|---|
| `/office-hours`, `/spec` | Turning an idea into a clear plan or spec |
| `/autoplan` | Auto-reviewing a plan (architecture, edge cases, tests) |
| `/review` | Reviewing the current diff before committing |
| `/qa` | Testing the app in a browser and fixing bugs |
| `/verify` | Running checks and tests until they pass |
| `/ship` | Merge, test, review, push and open a PR |
| `/careful`, `/guard`, `/freeze` | Safety rails for destructive commands and edits |

### graphify (codebase knowledge graph)

Version I'm on: **graphifyy 0.9.107**. Install it as a uv tool, then install its Claude skill:

```bash
uv tool install graphifyy
```

```bash
graphify install --platform claude
```

Use it with `/graphify` in Claude Code. It writes to `graphify-out/`, which is gitignored, so each of us builds our own copy.

### floorplan plugin (interactive architecture map)

In Claude Code (CLI):

```bash
claude plugin marketplace add https://github.com/haydenschmitty/floorplan.git
```

```bash
claude plugin install floorplan@floorplan
```

Then ask Claude to "draw a floorplan of this codebase". It saves `floorplan/index.html`.

### agent-skills and ponytail plugins (from your claude.ai account)

These two aren't CLI plugins. They're claude.ai account plugins, so `claude plugin list` won't show them. Install them yourself in the **Claude desktop app**: open the plugin directory, search for each name, and click install:

- **agent-skills**: engineering skills for spec, plan, build, test, review and ship (`/agent-skills:...`, plus the code-reviewer, security-auditor and test-engineer agents)
- **ponytail**: "lazy senior dev" mode. It pushes Claude toward the smallest complete change, which saves tokens. It turns on automatically at the start of each session (level `full`). Switch levels with `/ponytail lite|full|ultra`, or turn it off with "stop ponytail".

Restart Claude Code afterwards. Your session should then start with `PONYTAIL MODE ACTIVE`.

---

## 3. Optional: match my settings

These are in my personal `~/.claude/settings.json`. Change them only if you want to:

- **Default model: Sonnet** (`"model": "sonnet"`). It's cheaper on usage for routine coding. Switch to Opus for hard problems.
- **Ponytail status-line badge** (optional): shows `[PONYTAIL]` in the status line. Ponytail sets up `~/.claude/ponytail-statusline.ps1`, and you point to it with `"statusLine": { "type": "command", "command": "powershell -ExecutionPolicy Bypass -File \"C:\\Users\\<you>\\.claude\\ponytail-statusline.ps1\"" }`.

---

## What's shared vs. personal

| Shared (committed) | Personal (not committed) |
|---|---|
| `CLAUDE.md` (project instructions both Claudes read) | `CLAUDE.local.md` (your own notes for Claude) |
| `.claude/skills/`, `.claude/agents/`, `.claude/settings.json` | `.claude/settings.local.json` (your permission choices) |
| `.mcp.json` | Claude's auto-memory (lives in your user folder; each Claude builds its own) |

**Rule of thumb:** if something should apply to both of us, put it in `CLAUDE.md` or `.claude/`, not in your Claude's memory. Never put API keys in `.mcp.json`. Use `${ENV_VAR}` placeholders instead.
