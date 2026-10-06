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

const PI_HARNESS_MENTION = / operating inside pi, a coding agent harness/;
const DOCS_BLOCK_START = "Pi documentation (read only when";
// pi >= 0.86.0 renders prompt sections as <name>...</name> blocks
const SECTIONED_DOCS_BLOCK = /\n*<docs>\n(Pi documentation \(read only when.*?)\n<\/docs>/s;
// pi <= 0.85.x has a flat prompt; the docs block ends at a blank line or the trailer
const FLAT_DOCS_BLOCK =
  /\n\n(Pi documentation \(read only when.*?)(?=\n\n|\nCurrent date:|\nCurrent working directory:)/s;

export interface CleanPromptConfig {
  /** Clean the prompt for every model, not only Anthropic models via anthropic-messages. */
  alwaysOn: boolean;
  /** Let the model load the pi-docs skill on its own. When false, only /skill:pi-docs loads it. */
  agentInvocable: boolean;
}

const DEFAULT_CONFIG: CleanPromptConfig = { alwaysOn: false, agentInvocable: true };

export default function cleanPrompt(pi: ExtensionAPI) {
  let docsSkillRegistered = false;

  pi.on("resources_discover", (event, ctx) => {
    const config = loadConfig(event.cwd);
    docsSkillRegistered = config.alwaysOn || usesAnthropicMessagesApi(ctx.model);
    if (!docsSkillRegistered) return;
    return { skillPaths: [writeDocsSkill(placeholderDocsBody(), config)] };
  });

  pi.on("before_agent_start", (event, ctx) => {
    const config = loadConfig(ctx.cwd);
    const { prompt, docsBlock } = extractDocsBlock(event.systemPrompt);
    if (docsBlock && docsSkillRegistered) writeDocsSkill(docsBlock, config);
    if (!config.alwaysOn && !usesAnthropicMessagesApi(ctx.model)) return;
    if (!docsSkillRegistered) return { systemPrompt: event.systemPrompt.replace(PI_HARNESS_MENTION, "") };
    if (prompt.includes(DOCS_BLOCK_START) && ctx.hasUI) {
      ctx.ui.notify("pi-clean-prompt: pi docs block format changed, it was not stripped", "warning");
    }
    return { systemPrompt: prompt.replace(PI_HARNESS_MENTION, "") };
  });
}

export function loadConfig(cwd: string | undefined): CleanPromptConfig {
  const paths = [join(getAgentDir(), CONFIG_FILE_NAME)];
  if (cwd) paths.push(join(cwd, CONFIG_DIR_NAME, CONFIG_FILE_NAME));
  return paths.reduce<CleanPromptConfig>((config, path) => ({ ...config, ...readConfigFile(path) }), {
    ...DEFAULT_CONFIG,
  });
}

function readConfigFile(path: string): Partial<CleanPromptConfig> {
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const config: Partial<CleanPromptConfig> = {};
    if (typeof raw?.alwaysOn === "boolean") config.alwaysOn = raw.alwaysOn;
    if (typeof raw?.agentInvocable === "boolean") config.agentInvocable = raw.agentInvocable;
    return config;
  } catch (error) {
    console.error(`pi-clean-prompt: failed to read ${path}: ${error}`);
    return {};
  }
}

function extractDocsBlock(systemPrompt: string): { prompt: string; docsBlock?: string } {
  for (const pattern of [SECTIONED_DOCS_BLOCK, FLAT_DOCS_BLOCK]) {
    const match = systemPrompt.match(pattern);
    if (match) return { prompt: systemPrompt.replace(pattern, ""), docsBlock: match[1] };
  }
  return { prompt: systemPrompt };
}

function writeDocsSkill(body: string, config: CleanPromptConfig): string {
  const skill = readFileSync(DOCS_SKILL_TEMPLATE, "utf8")
    .replace("{{DISABLE_MODEL_INVOCATION}}", String(!config.agentInvocable))
    .replace("{{BODY}}", () => body);
  mkdirSync(dirname(DOCS_SKILL_PATH), { recursive: true });
  writeFileSync(DOCS_SKILL_PATH, skill);
  return DOCS_SKILL_PATH;
}

function placeholderDocsBody(): string {
  return [
    `- Main documentation: ${getReadmePath()}`,
    `- Additional docs: ${getDocsPath()}`,
    `- Examples: ${getExamplesPath()} (extensions, custom tools, SDK)`,
  ].join("\n");
}

function usesAnthropicMessagesApi(model: ExtensionContext["model"]): boolean {
  return model?.provider === "anthropic" && model.api === "anthropic-messages";
}
