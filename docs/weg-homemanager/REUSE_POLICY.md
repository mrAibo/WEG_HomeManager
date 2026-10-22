# Reuse-first engineering and product principles

## Default
**Adapt mature, maintained, properly licensed code; do not create a parallel app for the same task.**

### Main base
[HaVeWa](https://github.com/fgilde/hausverwaltung) — Next.js/TypeScript/PostgreSQL/Prisma, German WEG modules, bank imports, document management, tickets, Auth, REST/MCP. License AGPLv3 or separate commercial license. Not yet copied to our repo.

### Candidate references (inspect independently)
| Repo | Candidate valuable parts | License concern / decision |
|---|---|---|
| [open-condo-software/condo](https://github.com/open-condo-software/condo) | issue intake, resident communication, extensibility patterns | MIT, attribution required for adapted code |
| [vince844/kondomanager-free](https://github.com/vince844/kondomanager-free) | immutable accounting journal, double-entry and reconciliation concepts | AGPLv3; check licenses and database semantics on any actual reuse |
| [AtzeThon/WEG-Abrechnung](https://github.com/AtzeThon/WEG-Abrechnung) | CSV import workflow, simple allocation tests | No license identified at last review: **ideas only**, no source copying without permission |
| [halilcanakcay/AidatPro](https://github.com/halilcanakcay/AidatPro) | lightweight fee and tenant UI patterns | MIT but not German WEG compliant out of box; low priority |

Do not transfer code purely because it looks interesting. Require a demonstrated HaVeWa gap, compatibility analysis, security/tests and maintainability benefit.

## Short design decision log
- **WebGUI over native:** use existing Next.js and browser camera/file APIs; PWA later if real value.
- **Existing shadcn/ui over new component library:** keep visual consistency and minimize bundle.
- **Existing HaVeWa ticket/documents/WEG modules over replacements:** only add missing case orchestration and AI review workflows.
- **Existing AI provider SDKs over custom client stack:** adapter and scope enforcement, not model reinvention.
- **Exact accounting tests over model-generated numbers:** deterministic audited domain layer.
- **Assisted MyHammer link/copy over automated integration:** respects limited integrations and terms.
- **No third-party unlicensed copy-paste:** license requirements are part of definition-of-done.

## Ponytail seven-rung filter
YAGNI -> existing code -> standard library -> platform feature -> installed dependency -> minimal edit -> only then small new code.
Also delete unused code, avoid premature flags/factories and require a test whenever touching state, security or money.

## Lazy Admin (product-side)
Don't make owners enter what can be derived from an authorized document or property context. AI produces an editable first draft; users correct only uncertain fields; exact financial sources remain traceable. Limit follow-up questions to necessary ones. Save approved supplier templates and recurring approved tasks (never infer delegated legal authority).
