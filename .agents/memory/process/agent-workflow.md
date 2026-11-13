# Agent Workflow (Swarm & Verification)

1. **Coordinator delegates all code and docs work**: In swarm mode, the coordinator never edits repository files directly; it scopes slices, assigns owners, and integrates results.
2. **Independent verification before user reporting**: Every deliverable must be checked by a different agent than the author before it is reported to the user.
3. **Riskiest-assumption-first is guidance, not a gate**: Prioritize testing the riskiest technical assumption early to maximize learning velocity, without treating it as a rigid pre-code blocker.
