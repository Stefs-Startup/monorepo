# Version Control & Destructive Operations

1. **Never delete or overwrite uncommitted/untracked work without explicit user approval**: Do not run `rm -rf`, `git reset --hard`, or `git checkout --` on uncommitted or untracked files unless the user explicitly approves.
2. **Commit or stash before destructive or pivot operations**: Always preserve current work in git before pivoting architecture or cleaning a workspace.
3. **Park experiments in git rather than purging**: When the user wants to iterate on an experiment later, commit and park the code with a `PARKED` status in `decisions/` and `docs/experiments/iteration-log/` instead of deleting it.
