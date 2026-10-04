import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getDocsPath, getExamplesPath, getReadmePath } from "@earendil-works/pi-coding-agent";

const DOCS_SKILL_TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), "pi-docs.template.md");
const DOCS_SKILL_PATH = join(tmpdir(), "pi-clean-prompt", "pi-docs", "SKILL.md");

const PI_HARNESS_MENTION = / operating inside pi, a coding agent harness/;
const DOCS_BLOCK_START = "Pi documentation (read only when";
// pi >= 0.86.0 renders prompt sections as <name>...</name> blocks
const SECTIONED_DOCS_BLOCK = /\n*<docs>\n(Pi documentation \(read only when.*?)\n<\/docs>/s;
// pi <= 0.85.x has a flat prompt; the docs block ends at a blank line or the trailer
const FLAT_DOCS_BLOCK =
  /\n\n(Pi documentation \(read only when.*?)(?=\n\n|\nCurrent date:|\nCurrent working directory:)/s;

export default function cleanPrompt(pi: ExtensionAPI) {
  pi.on("resources_discover", () => ({ skillPaths: [writeDocsSkill(placeholderDocsBody())] }));

  pi.on("before_agent_start", (event, ctx) => {
    const { prompt, docsBlock } = extractDocsBlock(event.systemPrompt);
    if (docsBlock) writeDocsSkill(docsBlock);
    if (!usesAnthropicMessagesApi(ctx.model)) return;
    if (prompt.includes(DOCS_BLOCK_START) && ctx.hasUI) {
      ctx.ui.notify("pi-clean-prompt: pi docs block format changed, it was not stripped", "warning");
    }
    return { systemPrompt: prompt.replace(PI_HARNESS_MENTION, "") };
  });
}

function extractDocsBlock(systemPrompt: string): { prompt: string; docsBlock?: string } {
  for (const pattern of [SECTIONED_DOCS_BLOCK, FLAT_DOCS_BLOCK]) {
    const match = systemPrompt.match(pattern);
    if (match) return { prompt: systemPrompt.replace(pattern, ""), docsBlock: match[1] };
  }
  return { prompt: systemPrompt };
}

function writeDocsSkill(body: string): string {
  mkdirSync(dirname(DOCS_SKILL_PATH), { recursive: true });
  writeFileSync(DOCS_SKILL_PATH, readFileSync(DOCS_SKILL_TEMPLATE, "utf8").replace("{{BODY}}", () => body));
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
