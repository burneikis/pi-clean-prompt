import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getDocsPath, getExamplesPath, getReadmePath } from "@earendil-works/pi-coding-agent";

const DOCS_SKILL_TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "pi-docs.template.md");
const DOCS_SKILL_PATH = join(tmpdir(), "pi-clean-prompt", "pi-docs", "SKILL.md");

const PI_HARNESS_MENTION = / operating inside pi, a coding agent harness/;
// pi >= 0.86.0 renders prompt sections as <name>...</name> blocks
const SECTIONED_DOCS_BLOCK = /\n*<docs>\nPi documentation \(read only when.*?<\/docs>/s;
// pi <= 0.85.x has a flat prompt; the docs block ends at a blank line or the trailer
const FLAT_DOCS_BLOCK =
  /\n\nPi documentation \(read only when.*?(?=\n\n|\nCurrent date:|\nCurrent working directory:)/s;

export default function cleanPrompt(pi: ExtensionAPI) {
  pi.on("resources_discover", () => ({ skillPaths: [writeDocsSkill()] }));

  pi.on("before_agent_start", (event, ctx) => {
    if (!usesAnthropicMessagesApi(ctx.model)) return;
    return { systemPrompt: removePiMentions(event.systemPrompt) };
  });
}

function writeDocsSkill(): string {
  mkdirSync(dirname(DOCS_SKILL_PATH), { recursive: true });
  writeFileSync(DOCS_SKILL_PATH, renderDocsSkill());
  return DOCS_SKILL_PATH;
}

function renderDocsSkill(): string {
  return readFileSync(DOCS_SKILL_TEMPLATE, "utf8")
    .replaceAll("{{README}}", getReadmePath())
    .replaceAll("{{DOCS}}", getDocsPath())
    .replaceAll("{{EXAMPLES}}", getExamplesPath());
}

function usesAnthropicMessagesApi(model: ExtensionContext["model"]): boolean {
  return model?.provider === "anthropic" && model.api === "anthropic-messages";
}

function removePiMentions(systemPrompt: string): string {
  return systemPrompt
    .replace(PI_HARNESS_MENTION, "")
    .replace(SECTIONED_DOCS_BLOCK, "")
    .replace(FLAT_DOCS_BLOCK, "");
}
