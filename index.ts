import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
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
