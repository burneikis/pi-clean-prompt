import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

const AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-clean-prompt-agent-"));
const PROJECT_DIR = mkdtempSync(join(tmpdir(), "pi-clean-prompt-project-"));
const GLOBAL_CONFIG = join(AGENT_DIR, "clean-prompt.json");
const PROJECT_CONFIG = join(PROJECT_DIR, ".pi", "clean-prompt.json");

const PI_RUNTIME_STUB = `data:text/javascript,
  export const CONFIG_DIR_NAME = ".pi";
  export const getAgentDir = () => ${JSON.stringify(AGENT_DIR)};
  export const getReadmePath = () => "/pi/README.md";
  export const getDocsPath = () => "/pi/docs";
  export const getExamplesPath = () => "/pi/examples";`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@earendil-works/pi-coding-agent") return { url: PI_RUNTIME_STUB, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

process.on("exit", () => {
  rmSync(AGENT_DIR, { recursive: true, force: true });
  rmSync(PROJECT_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(GLOBAL_CONFIG, { force: true });
  rmSync(PROJECT_CONFIG, { force: true });
});

const { default: cleanPrompt } = await import("./index.ts");
const handlers = registerExtension();
const skillPath = handlers.resources_discover({ type: "resources_discover", cwd: "/tmp", reason: "startup" }).skillPaths[0];

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

test("docs skill holds exactly the stripped sectioned docs block", () => {
  beforeAgentStart(SECTIONED_PROMPT, ANTHROPIC);
  assert.match(readSkill(), /\nPi documentation \(read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI\):\n- some doc bullet\n$/);
});

test("docs skill holds exactly the stripped flat docs block", () => {
  beforeAgentStart(FLAT_PROMPT, ANTHROPIC);
  assert.match(readSkill(), /\nPi documentation \(read only when the user asks about pi itself\):\n- some doc bullet\n$/);
});

test("docs skill follows new content in the docs block", () => {
  beforeAgentStart(SECTIONED_PROMPT.replace("- some doc bullet", "- brand new topic"), ANTHROPIC);
  assert.match(readSkill(), /- brand new topic/);
  assert.doesNotMatch(readSkill(), /some doc bullet/);
});

test("docs skill is updated for non-anthropic models too", () => {
  beforeAgentStart(SECTIONED_PROMPT.replace("- some doc bullet", "- openai run"), { provider: "openai", api: "openai-responses" });
  assert.match(readSkill(), /- openai run/);
});

test("warns when the docs block is present but not matched", () => {
  const warnings = [];
  const ui = { notify: (message, type) => warnings.push({ message, type }) };
  const prompt = SECTIONED_PROMPT.replace("<docs>", "<pi_docs>").replace("</docs>", "</pi_docs>");
  handlers.before_agent_start({ type: "before_agent_start", prompt: "hi", systemPrompt: prompt }, { model: ANTHROPIC, hasUI: true, ui });
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].type, "warning");
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

test("docs skill is agent invocable by default", () => {
  beforeAgentStart(SECTIONED_PROMPT, ANTHROPIC);
  assert.match(readSkill(), /\ndisable-model-invocation: false\n/);
});

test("agentInvocable false disables model invocation of the docs skill", () => {
  writeConfig(GLOBAL_CONFIG, { agentInvocable: false });
  beforeAgentStart(SECTIONED_PROMPT, ANTHROPIC);
  assert.match(readSkill(), /\ndisable-model-invocation: true\n/);
});

test("agentInvocable false applies on resources_discover", () => {
  writeConfig(GLOBAL_CONFIG, { agentInvocable: false });
  handlers.resources_discover({ type: "resources_discover", cwd: "/tmp", reason: "startup" });
  assert.match(readSkill(), /\ndisable-model-invocation: true\n/);
});

test("alwaysOn cleans the prompt for non-anthropic models", () => {
  writeConfig(GLOBAL_CONFIG, { alwaysOn: true });
  for (const model of Object.values(untouchedModels)) {
    assert.equal(systemPromptFor(SECTIONED_PROMPT, model), CLEAN_SECTIONED_PROMPT);
  }
});

test("project config overrides global config", () => {
  writeConfig(GLOBAL_CONFIG, { alwaysOn: true, agentInvocable: false });
  writeConfig(PROJECT_CONFIG, { alwaysOn: false });
  const model = { provider: "openai", api: "openai-responses" };
  assert.equal(beforeAgentStart(SECTIONED_PROMPT, model, PROJECT_DIR), undefined);
  assert.match(readSkill(), /\ndisable-model-invocation: true\n/);
});

test("invalid config values are ignored", () => {
  writeConfig(GLOBAL_CONFIG, { alwaysOn: "yes", agentInvocable: 0 });
  assert.equal(beforeAgentStart(SECTIONED_PROMPT, { provider: "openai", api: "openai-responses" }), undefined);
  assert.match(readSkill(), /\ndisable-model-invocation: false\n/);
});

function writeConfig(path, config) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(config));
}

function registerExtension() {
  const registered = {};
  cleanPrompt({ on: (event, handler) => (registered[event] = handler) });
  return registered;
}

function beforeAgentStart(systemPrompt, model, cwd = "/tmp") {
  return handlers.before_agent_start({ type: "before_agent_start", prompt: "hi", systemPrompt }, { model, cwd });
}

function readSkill() {
  return readFileSync(skillPath, "utf8");
}

function systemPromptFor(systemPrompt, model) {
  return beforeAgentStart(systemPrompt, model)?.systemPrompt;
}
