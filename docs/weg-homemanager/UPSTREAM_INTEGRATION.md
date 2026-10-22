# Upstream intake — HaVeWa

## Observed repository state (22 Oct 2026)
- New repository: `mrAibo/WEG_HomeManager`, public, currently independent (GitHub `fork=false`), initially only a README.
- Intended upstream: `fgilde/hausverwaltung` (HaVeWa), AGPLv3 / commercial dual-licensing.
- Remote Aibo Windows desktop reconnected on 2026-10-22. Local Git network access is now available.
- HaVeWa source **has been merged in a separate integration branch** based on the original AI-first foundation, retaining authorship/history; exact SHA `cb130792cfe40444c35827d059900f3b552a9af4`.
- See `docs/weg-homemanager/BASELINE_VERIFICATION.md` for test results, caveats and archived upstream release workflows.

## Recommended upstream import by a trusted local git client
A reliable approach that preserves the existing independent repo:
```bash
git clone https://github.com/mrAibo/WEG_HomeManager.git
cd WEG_HomeManager
git remote add upstream https://github.com/fgilde/hausverwaltung.git
git fetch upstream main
git switch -c integration/havewa-baseline
git merge --allow-unrelated-histories --no-commit upstream/main
# Resolve README and any other overlaps, preserve the original HaVeWa copyright,
# LICENSE and LICENSING.md, then complete the merge and run verification.
git status
git commit -m "chore: import HaVeWa upstream baseline"
git push -u origin integration/havewa-baseline
```
Create a pull request to main **only after** license review, dependency installation and build/tests. Keep the upstream remote to support future merges. Alternatively recreate as a GitHub fork, but that changes the repo topology and may affect repository identity. Do not replace or force-push the existing repo.

## Licensing
AGPLv3 is a valid path for an open-source derived web application, including commercial use under its conditions. If the future product must be proprietary, arrange HaVeWa's alternative commercial license **before** using its code that way.
Never copy source code from a repository with no clear compatible license.

## Review upstream before integration
Read `src/lib/ai.ts`, `src/components/ai-assistant.tsx`, `src/app/api/mcp/route.ts`, the existing tickets/documents API and ACL system. Add a separate AI case orchestration layer rather than reimplementing upstream accounting, tickets or documents wholesale.
