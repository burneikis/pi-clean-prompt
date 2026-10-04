import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";

const PI_RUNTIME_STUB = `data:text/javascript,
  export const getReadmePath = () => "/pi/README.md";
  export const getDocsPath = () => "/pi/docs";
  export const getExamplesPath = () => "/pi/examples";`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@earendil-works/pi-coding-agent") return { url: PI_RUNTIME_STUB, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const { default: cleanPrompt } = await import("./index.ts");
const handlers = registerExtension();

const ANTHROPIC = { provider: "anthropic", api: "anthropic-messages" };

const SECTIONED_PROMPT = `You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files.

<rules>
- Be concise in your responses
</rules>

<docs>
Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):
- some doc bullet
</docs>

<cwd>
/tmp
</cwd>`;

const CLEAN_SECTIONED_PROMPT = `You are an expert coding assistant. You help users by reading files.

<rules>
- Be concise in your responses
</rules>

<cwd>
/tmp
</cwd>`;

const FLAT_PROMPT = `You are an expert coding assistant operating inside pi, a coding agent harness.

Guidelines:
- Be concise

Pi documentation (read only when the user asks about pi itself):
- some doc bullet
Current date: 2025-01-01
Current working directory: /tmp`;

const CLEAN_FLAT_PROMPT = `You are an expert coding assistant.

Guidelines:
- Be concise
Current date: 2025-01-01
Current working directory: /tmp`;

test("docs skill is rendered with pi paths", () => {
  const { skillPaths } = handlers.resources_discover({ type: "resources_discover", cwd: "/tmp", reason: "startup" });
  const skill = readFileSync(skillPaths[0], "utf8");
  assert.match(skill, /Main documentation: \/pi\/README\.md/);
  assert.match(skill, /Additional docs: \/pi\/docs/);
  assert.match(skill, /Examples: \/pi\/examples/);
  assert.doesNotMatch(skill, /\{\{\w+\}\}/);
});

test("sectioned prompt (pi >= 0.86) is cleaned for anthropic-messages", () => {
  assert.equal(systemPromptFor(SECTIONED_PROMPT, ANTHROPIC), CLEAN_SECTIONED_PROMPT);
});

test("flat prompt (pi <= 0.85) is cleaned for anthropic-messages", () => {
  assert.equal(systemPromptFor(FLAT_PROMPT, ANTHROPIC), CLEAN_FLAT_PROMPT);
});

const untouchedModels = {
  "openai provider": { provider: "openai", api: "openai-responses" },
  "claude via bedrock": { provider: "amazon-bedrock", api: "bedrock-converse-stream" },
  "no model": undefined,
};

for (const [label, model] of Object.entries(untouchedModels)) {
  test(`prompt is left alone for ${label}`, () => {
    assert.equal(beforeAgentStart(SECTIONED_PROMPT, model), undefined);
  });
}

function registerExtension() {
  const registered = {};
  cleanPrompt({ on: (event, handler) => (registered[event] = handler) });
  return registered;
}

function beforeAgentStart(systemPrompt, model) {
  return handlers.before_agent_start({ type: "before_agent_start", prompt: "hi", systemPrompt }, { model });
}

function systemPromptFor(systemPrompt, model) {
  return beforeAgentStart(systemPrompt, model)?.systemPrompt;
}
