# Git Workflow Standards

Standards for version control, branching, and commit practices.

## Branch Strategy

### Main Branches
```
main (production)
  └── Protected, requires PR approval
  └── Always deployable
  └── Squash merge only

develop (optional)
  └── Integration branch for features
  └── Merged to main for releases
```

### Feature Branches
```
feat/[description]     # New features
fix/[description]      # Bug fixes
refactor/[description] # Code refactoring
test/[description]     # Test additions
docs/[description]     # Documentation
chore/[description]    # Maintenance

# Examples
feat/user-authentication
fix/login-redirect-loop
refactor/payment-service
```

### Branch Naming
- Use kebab-case
- Be descriptive but concise
- Include issue number if applicable

```bash
# Good
feat/add-user-notifications
fix/123-password-reset-timeout
refactor/extract-auth-service

# Bad
feature1
my-changes
test
```

## Commit Messages

### Conventional Commits
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types
| Type | Description |
|------|-------------|
| feat | New feature |
| fix | Bug fix |
| refactor | Code change (no feature/fix) |
| test | Adding tests |
| docs | Documentation |
| style | Formatting (no code change) |
| chore | Maintenance tasks |
| perf | Performance improvement |

### Examples
```bash
# Simple
feat(auth): add password reset flow

# With body
fix(api): handle null user in profile endpoint

The profile endpoint was throwing when user was deleted
but session still active. Now returns 401.

Fixes #123

# Breaking change
feat(api)!: change user ID from number to UUID

BREAKING CHANGE: All API endpoints now use UUID for user IDs.
Migration script: npm run migrate:user-ids

# Multiple scopes
feat(auth,api): add refresh token rotation
```

### Rules
1. Use imperative mood ("add" not "added")
2. Don't capitalize first letter
3. No period at end
4. Keep subject line under 72 characters
5. Separate subject from body with blank line

## Workflow

### Feature Development
```bash
# 1. Start from updated main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/new-feature

# 3. Make changes and commit often
git add .
git commit -m "feat(ui): add user avatar component"

git add .
git commit -m "test(ui): add avatar component tests"

# 4. Keep branch updated with main
git fetch origin main
git rebase origin/main

# 5. Push to remote
git push -u origin feat/new-feature

# 6. Create PR
gh pr create --title "feat: Add user avatar component" --body "..."

# 7. After approval, squash merge
# (Done via GitHub PR)
```

### Bug Fixes
```bash
# 1. Create fix branch
git checkout -b fix/login-bug

# 2. Write failing test first
git add .
git commit -m "test(auth): add failing test for login bug"

# 3. Implement fix
git add .
git commit -m "fix(auth): handle empty password in login"

# 4. Push and create PR
git push -u origin fix/login-bug
gh pr create --title "fix: Handle empty password in login"
```

### Hotfix (Production)
```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bug

# 2. Fix and test
git add .
git commit -m "fix(auth): patch critical token validation bug"

# 3. Create urgent PR
gh pr create --title "HOTFIX: Critical auth bug" --label urgent

# 4. After merge, deploy immediately
```

## Pull Requests

### Creating PRs
```bash
gh pr create \
  --title "feat: Add user notifications" \
  --body "$(cat <<'EOF'
## Summary
- Add in-app notification system
- Support email notifications
- Add notification preferences

## Changes
- Created NotificationService
- Added notification UI components
- Added email templates

## Testing
- Unit tests: 95% coverage
- Manual testing: Verified all notification types

## Screenshots
[Attach if UI changes]
EOF
)"
```

### PR Checklist
- [ ] Title follows conventional commits
- [ ] Description explains what and why
- [ ] Tests pass
- [ ] No merge conflicts
- [ ] Requested reviewers
- [ ] Labels added

### Reviewing PRs
1. Read the description
2. Check test coverage
3. Review code changes
4. Run locally if needed
5. Approve or request changes with specific feedback

## Merging

### Squash Merge (Recommended)
- Keeps main history clean
- One commit per feature
- Easier to revert

```bash
# Via GitHub: "Squash and merge" button

# Or manually
git checkout main
git merge --squash feat/new-feature
git commit -m "feat: add new feature (#123)"
```

### Rebase Before Merge
```bash
# Update branch before merging
git checkout feat/new-feature
git fetch origin main
git rebase origin/main

# Resolve any conflicts
git add .
git rebase --continue

# Force push (only on feature branches!)
git push --force-with-lease
```

## Protected Branches

### Main Branch Rules
- Require PR approval (1+ reviewers)
- Require passing CI checks
- Require up-to-date branch
- No force push
- No direct push

### Recommended Settings
```yaml
# .github/branch-protection.yml
branches:
  - name: main
    protection:
      required_pull_request_reviews:
        required_approving_review_count: 1
        dismiss_stale_reviews: true
      required_status_checks:
        strict: true
        contexts:
          - build
          - test
          - lint
      enforce_admins: true
      required_linear_history: true
```

## Common Commands

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Amend last commit
git commit --amend -m "new message"

# Interactive rebase (clean up commits)
git rebase -i HEAD~3

# Stash changes
git stash
git stash pop

# View history
git log --oneline -20
git log --graph --oneline --all

# Find when bug was introduced
git bisect start
git bisect bad HEAD
git bisect good v1.0.0
# Test each commit, mark good/bad
git bisect reset
```

## Don'ts

1. **Don't force push to main** - Ever
2. **Don't commit secrets** - Use .env and .gitignore
3. **Don't commit large files** - Use Git LFS
4. **Don't rewrite shared history** - Only rebase local branches
5. **Don't commit broken code** - Tests should pass
