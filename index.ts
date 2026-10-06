import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  CONFIG_DIR_NAME,
  getAgentDir,
  getDocsPath,
  getExamplesPath,
  getReadmePath,
} from "@earendil-works/pi-coding-agent";

const DOCS_SKILL_TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "pi-docs.template.md");
const DOCS_SKILL_PATH = join(tmpdir(), "pi-clean-prompt", "pi-docs", "SKILL.md");
const CONFIG_FILE_NAME = "clean-prompt.json";

const PI_HARNESS_MENTION = " operating inside pi, a coding agent harness";
const DOCS_BLOCK_START = "Pi documentation (read only when";
const DOCS_BLOCK_START_PATTERN = escapeRegExp(DOCS_BLOCK_START);
// pi >= 0.86.0 renders prompt sections as <name>...</name> blocks
const SECTIONED_DOCS_BLOCK = new RegExp(String.raw`\n*<docs>\n(${DOCS_BLOCK_START_PATTERN}.*?)\n</docs>`, "s");
// pi <= 0.85.x has a flat prompt; the docs block ends at a blank line or the trailer
const FLAT_DOCS_BLOCK = new RegExp(
  String.raw`\n\n(${DOCS_BLOCK_START_PATTERN}.*?)(?=\n\n|\nCurrent date:|\nCurrent working directory:)`,
  "s",
);

interface CleanPromptConfig {
  /** Clean the prompt for every model, not only Anthropic models via anthropic-messages. */
  alwaysOn: boolean;
  /** Let the model load the pi-docs skill on its own. When false, only /skill:pi-docs loads it. */
  agentInvocable: boolean;
}

const DEFAULT_CONFIG: CleanPromptConfig = { alwaysOn: false, agentInvocable: true };

type Model = ExtensionContext["model"];

export default function cleanPrompt(pi: ExtensionAPI) {
  let docsSkillRegistered = false;

  pi.on("resources_discover", (event, ctx) => {
    const config = loadConfig(event.cwd);
    docsSkillRegistered = shouldCleanPrompt(config, ctx.model);
    if (!docsSkillRegistered) return;
    writeDocsSkill(placeholderDocsBody(), config);
    return { skillPaths: [DOCS_SKILL_PATH] };
  });

  pi.on("before_agent_start", (event, ctx) => {
    const config = loadConfig(ctx.cwd);
    const { prompt, docsBlock } = extractDocsBlock(event.systemPrompt);
    if (docsBlock && docsSkillRegistered) writeDocsSkill(docsBlock, config);
    if (!shouldCleanPrompt(config, ctx.model)) return;
    if (!docsSkillRegistered) return { systemPrompt: removeHarnessMention(event.systemPrompt) };
    if (prompt.includes(DOCS_BLOCK_START)) warnDocsBlockNotStripped(ctx);
    return { systemPrompt: removeHarnessMention(prompt) };
  });
}

function shouldCleanPrompt(config: CleanPromptConfig, model: Model): boolean {
  return config.alwaysOn || usesAnthropicMessagesApi(model);
}

function usesAnthropicMessagesApi(model: Model): boolean {
  return model?.provider === "anthropic" && model.api === "anthropic-messages";
}

function loadConfig(cwd: string | undefined): CleanPromptConfig {
  return configPaths(cwd).reduce<CleanPromptConfig>(
    (config, path) => ({ ...config, ...readConfigFile(path) }),
    DEFAULT_CONFIG,
  );
}

function configPaths(cwd: string | undefined): string[] {
  const globalPath = join(getAgentDir(), CONFIG_FILE_NAME);
  if (!cwd) return [globalPath];
  return [globalPath, join(cwd, CONFIG_DIR_NAME, CONFIG_FILE_NAME)];
}

function readConfigFile(path: string): Partial<CleanPromptConfig> {
  if (!existsSync(path)) return {};
  try {
    return pickBooleanOptions(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    console.error(`pi-clean-prompt: failed to read ${path}: ${error}`);
    return {};
  }
}

function pickBooleanOptions(raw: Record<string, unknown> | null): Partial<CleanPromptConfig> {
  const optionNames = Object.keys(DEFAULT_CONFIG);
  return Object.fromEntries(
    optionNames.filter((name) => typeof raw?.[name] === "boolean").map((name) => [name, raw?.[name]]),
  );
}

function extractDocsBlock(systemPrompt: string): { prompt: string; docsBlock?: string } {
  for (const pattern of [SECTIONED_DOCS_BLOCK, FLAT_DOCS_BLOCK]) {
    const match = systemPrompt.match(pattern);
    if (match) return { prompt: systemPrompt.replace(pattern, ""), docsBlock: match[1] };
  }
  return { prompt: systemPrompt };
}

function removeHarnessMention(systemPrompt: string): string {
  return systemPrompt.replace(PI_HARNESS_MENTION, "");
}

function warnDocsBlockNotStripped(ctx: ExtensionContext) {
  if (!ctx.hasUI) return;
  ctx.ui.notify("pi-clean-prompt: pi docs block format changed, it was not stripped", "warning");
}

function writeDocsSkill(body: string, config: CleanPromptConfig) {
  mkdirSync(dirname(DOCS_SKILL_PATH), { recursive: true });
  writeFileSync(DOCS_SKILL_PATH, renderDocsSkill(body, config));
}

function renderDocsSkill(body: string, config: CleanPromptConfig): string {
  return readFileSync(DOCS_SKILL_TEMPLATE, "utf8")
    .replace("{{DISABLE_MODEL_INVOCATION}}", String(!config.agentInvocable))
    .replace("{{BODY}}", () => body);
}

function placeholderDocsBody(): string {
  return [
    `- Main documentation: ${getReadmePath()}`,
    `- Additional docs: ${getDocsPath()}`,
    `- Examples: ${getExamplesPath()} (extensions, custom tools, SDK)`,
  ].join("\n");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
