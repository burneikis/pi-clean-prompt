import { readFileSync } from "node:fs";

// Load the extension source, strip type syntax, stub the pi runtime import,
// and import it via a data: URL so we don't need any build step.
const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  .replace(/^\s*import\s+type\s+.*$/m, "")
  .replace(
    /^import \{[^}]*\} from "@earendil-works\/pi-coding-agent";$/m,
    `const getReadmePath = () => "/pi/README.md", getDocsPath = () => "/pi/docs", getExamplesPath = () => "/pi/examples";`,
  )
  .replace(/:\s*ExtensionAPI/g, "")
  .replace(/: string/g, "")
  .replace("import.meta.url", JSON.stringify(new URL("./index.ts", import.meta.url).href));
const mod = await import("data:text/javascript," + encodeURIComponent(src));

// Capture the handler the extension registers.
let handler;
let discover;
const pi = {
  on(event, fn) {
    if (event === "before_agent_start") handler = fn;
    if (event === "resources_discover") discover = fn;
  },
};
mod.default(pi);

const { skillPaths } = discover({ type: "resources_discover", cwd: "/tmp", reason: "startup" });
console.log(`=== rendered skill: ${skillPaths[0]} ===`);
console.log(readFileSync(skillPaths[0], "utf8").split("\n").slice(10, 15).join("\n"));

// A representative system prompt containing the bits the extension strips.
const SYSTEM_PROMPT = [
  "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files.",
  "",
  "<rules>",
  "- Be concise in your responses",
  "</rules>",
  "",
  "<docs>",
  "Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):",
  "- some doc bullet",
  "- another doc bullet",
  "</docs>",
  "",
  "<cwd>",
  "/tmp",
  "</cwd>",
].join("\n");

const event = { type: "before_agent_start", prompt: "hi", systemPrompt: SYSTEM_PROMPT };

const cases = [
  { label: "anthropic provider + anthropic-messages", model: { provider: "anthropic", api: "anthropic-messages" } },
  { label: "openai provider", model: { provider: "openai", api: "openai-responses" } },
  { label: "bedrock claude (provider != anthropic)", model: { provider: "amazon-bedrock", api: "bedrock-converse-stream" } },
  { label: "no model", model: undefined },
];

for (const c of cases) {
  const result = await handler(event, { model: c.model });
  const out = result?.systemPrompt ?? event.systemPrompt; // undefined => unchanged
  const cleaned = result?.systemPrompt !== undefined && result.systemPrompt !== SYSTEM_PROMPT;
  console.log(`\n=== ${c.label} ===`);
  console.log(`changed: ${cleaned}`);
  console.log(out);
}
