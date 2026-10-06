# pi-clean-prompt

A pi extension that removes pi-specific text from the system prompt.

It does two things:

1. It removes the phrase ` operating inside pi, a coding agent harness` from the opening line.
2. It removes the "Pi documentation" block and moves it into an on-demand `pi-docs` skill. The model reads the docs only when the user asks about pi.

The result is a shorter, harness-neutral prompt. The pi docs stay available when you need them.

## Install

```sh
pi install https://github.com/burneikis/pi-clean-prompt
```

Or add it to `packages` in `~/.pi/agent/settings.json`:

```json
{
  "packages": ["https://github.com/burneikis/pi-clean-prompt"]
}
```

## When it runs

By default, the extension cleans the prompt only for Anthropic models that use the `anthropic-messages` API (provider `anthropic`). It leaves the prompt unchanged for other providers, for example OpenAI or Claude through Bedrock. Set `alwaysOn` to clean the prompt for all models.

The extension registers the `pi-docs` skill when the session starts. If the session starts on a model that it does not clean, it does not register the skill. If you then switch to an Anthropic model, the extension removes only the phrase and keeps the docs block in the prompt, so the docs are never lost.

## The pi-docs skill

The extension writes the skill to `$TMPDIR/pi-clean-prompt/pi-docs/SKILL.md`. It builds the skill from `pi-docs.template.md` and the docs block that it removed from the current prompt. Thus the skill always matches the docs of your installed pi version.

- Load it manually with `/skill:pi-docs`.
- By default, the model can also load it on its own. Set `agentInvocable` to `false` to allow only manual loading.

## Configuration

Create `clean-prompt.json` in one or both of these locations:

| Location                          | Scope   |
| --------------------------------- | ------- |
| `~/.pi/agent/clean-prompt.json`   | Global  |
| `<project>/.pi/clean-prompt.json` | Project |

Project values override global values. The extension ignores values that are not booleans.

```json
{
  "alwaysOn": false,
  "agentInvocable": true
}
```

| Option           | Default | Description                                                                         |
| ---------------- | ------- | ----------------------------------------------------------------------------------- |
| `alwaysOn`       | `false` | Clean the prompt for all models, not only Anthropic models via `anthropic-messages`. |
| `agentInvocable` | `true`  | Let the model load the `pi-docs` skill. When `false`, only `/skill:pi-docs` loads it. |

## Compatibility

The extension supports both system prompt formats:

- pi >= 0.86.0: sectioned prompt, docs in a `<docs>...</docs>` block.
- pi <= 0.85.x: flat prompt, docs block ends at a blank line or at the `Current date:` / `Current working directory:` trailer.

If pi changes the docs block format and the extension cannot remove it, it shows a warning in the UI.

## Development

```sh
npm test
```

`verify.mjs` stubs the pi runtime and runs the tests with `node:test`.
