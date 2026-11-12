# GitHub Copilot & AI Instructions for PXL Web NetSim

Please strictly follow the multi-agent collaboration and concurrency protocol defined in [`AGENTS.md`](../AGENTS.md).

## Critical Workflow Before Making ANY Changes:
1. Always run `git pull` first.
2. Check `.ai-sync/LOCK.json`.
   - If `"status": "LOCKED"`, STOP immediately and inform the user that the project is locked by the person/AI indicated in `locked_by`.
   - If `"status": "FREE"`, update `.ai-sync/LOCK.json` with `"status": "LOCKED"`, your name/tool, timestamp and task, commit and push it before continuing.
3. Read `.ai-sync/CONTEXT_LOG.md` to get full context of the project architecture and recent decisions.

## Workflow When Finishing:
1. Add a clear entry at the top of `.ai-sync/CONTEXT_LOG.md` summarizing what you changed, logic applied, and any open TODOs.
2. Reset `.ai-sync/LOCK.json` to `"status": "FREE"` with `null` fields.
3. Commit all changes and push to `origin main`.
