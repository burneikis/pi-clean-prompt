---
name: pi-docs
description: Pi documentation reference. Use only when the user asks about pi itself, its SDK, extensions, themes, skills, prompt templates, TUI, keybindings, custom providers, models, pi packages, environment variables, or MCP servers.
---

# Pi Documentation

Reference for pi (the coding agent harness) itself. Read these only when the user asks about pi, its SDK, extensions, themes, skills, or TUI.

## Documentation Paths

- Main documentation: {{README}}
- Additional docs: {{DOCS}}
- Examples: {{EXAMPLES}} (extensions, custom tools, SDK)

When reading pi docs or examples, resolve `docs/...` under Additional docs and `examples/...` under Examples, not the current working directory.

## Topic Map

When asked about a topic, read the matching doc:

- extensions: docs/extensions.md, examples/extensions/
- themes: docs/themes.md
- skills: docs/skills.md
- prompt templates: docs/prompt-templates.md
- TUI components: docs/tui.md
- keybindings: docs/keybindings.md
- SDK integrations: docs/sdk.md
- custom providers: docs/custom-provider.md
- adding models: docs/models.md
- pi packages: docs/packages.md
- environment variables: docs/environment-variables.md
- MCP servers: docs/mcp.md

## Workflow

- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing.
- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details).
