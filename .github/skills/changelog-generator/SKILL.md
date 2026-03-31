---
name: changelog-generator
description: Generate a CHANGELOG.md entry following the Keep a Changelog format.
---

Rules:

- Use these change categories (omit empty ones): Added, Changed, Deprecated, Removed, Fixed, Security
- Format version headers as: ## [VERSION] - YYYY-MM-DD (ISO 8601 date)
- List the latest version first (reverse chronological order)
- Keep an ## [Unreleased] section at the top but only when there are unreleased changes to document
- Write entries for humans, not machines — no commit hashes, no jargon
- Each entry is a single concise bullet starting with a past-tense verb
- Make the key points **bold**
- Never dump raw git log output; summarize noteworthy differences
- Mark yanked releases as: ## [VERSION] - DATE [YANKED]
- Add comparison links at the bottom: [VERSION]: https://github.com/USER/REPO/compare/vPREV...vCURRENT
- Note adherence to Semantic Versioning in the file header

Header template:

```
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
```
