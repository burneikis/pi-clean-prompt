import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event) => {
    let prompt = event.systemPrompt;

    // Remove "operating inside pi, a coding agent harness" from the opening sentence
    prompt = prompt.replace(/ operating inside pi, a coding agent harness/, "");

    // Remove the Pi documentation block (from the blank line before "Pi documentation" to the end of the last bullet)
    prompt = prompt.replace(/\n\nPi documentation \(read only when.*?(?=\n\n|\nCurrent date:|\nCurrent working directory:)/s, "");

    return { systemPrompt: prompt };
  });
}
