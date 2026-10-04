import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getDocsPath, getExamplesPath, getReadmePath } from "@earendil-works/pi-coding-agent";

const baseDir = dirname(fileURLToPath(import.meta.url));

function renderDocsSkill(): string {
  const skill = readFileSync(join(baseDir, "pi-docs.template.md"), "utf8")
    .replaceAll("{{README}}", getReadmePath())
    .replaceAll("{{DOCS}}", getDocsPath())
    .replaceAll("{{EXAMPLES}}", getExamplesPath());

  const skillPath = join(tmpdir(), "pi-clean-prompt", "pi-docs", "SKILL.md");
  mkdirSync(dirname(skillPath), { recursive: true });
  writeFileSync(skillPath, skill);
  return skillPath;
}

export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", () => ({ skillPaths: [renderDocsSkill()] }));

  pi.on("before_agent_start", (event, ctx) => {
    // Only run when using an Anthropic model through the Anthropic provider
    if (ctx.model?.provider !== "anthropic" || ctx.model?.api !== "anthropic-messages") {
      return;
    }

    let prompt = event.systemPrompt;

    // Remove "operating inside pi, a coding agent harness" from the opening sentence
    prompt = prompt.replace(/ operating inside pi, a coding agent harness/, "");

    // >= 0.86.0: prompt sections are rendered as <name>...</name> blocks joined by blank lines
    prompt = prompt.replace(/\n*<docs>\nPi documentation \(read only when.*?<\/docs>/s, "");

    // <= 0.85.x: flat prompt, docs block ran until the next blank line or trailer
    prompt = prompt.replace(/\n\nPi documentation \(read only when.*?(?=\n\n|\nCurrent date:|\nCurrent working directory:)/s, "");

    return { systemPrompt: prompt };
  });
}
