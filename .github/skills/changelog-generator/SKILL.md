---
name: changelog-generator
description: Generate a CHANGELOG.md entry following the Keep a Changelog format.
---

Rules:

- **Before writing any entry, check the git log since the last version tag**: run `git log <last-tag>..HEAD --oneline` (or `git log $(git describe --tags --abbrev=0)..HEAD --oneline`) to get all commits since the last release, then summarize them into human-readable entries
- Use these change categories (omit empty ones): Added, Changed, Deprecated, Removed, Fixed, Security
- Format version headers as: ## [vVERSION] - YYYY-MM-DD (ISO 8601 date)
- List the latest version first (reverse chronological order)
- Keep an ## [Unreleased] section at the top but only when there are unreleased changes to document
- Write entries for humans, not machines: no commit hashes, no jargon, and no raw git log dumps
- Each entry is a single concise bullet starting with a past-tense verb
- Bold key points only when it improves readability
- Mark yanked releases as: ## [vVERSION] - DATE [YANKED]
- Note adherence to Semantic Versioning in the file header

Header template:

```
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
```
