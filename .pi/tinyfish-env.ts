/**
 * TinyFish plugin shim: supplies the API key, then re-exports the plugin.
 *
 * pi-tinyfish resolves the key from `process.env.TINYFISH_API_KEY` at call time.
 * pi's own process was started before the key existed, so a child session would
 * otherwise fail with "Missing API key" no matter how the task is phrased.
 *
 * Referenced only via an agent's `subagentOnlyExtensions`, so it loads in that
 * agent's child sessions and never in the parent. The key itself is never
 * inlined here: it is read from a 0600 file outside the repository.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

if (!process.env.TINYFISH_API_KEY) {
	try {
		const file = join(homedir(), ".pi", "agent", "secrets", "tinyfish.env");
		const match = readFileSync(file, "utf8").match(/TINYFISH_API_KEY="([^"]+)"/);
		if (match?.[1]) process.env.TINYFISH_API_KEY = match[1];
	} catch {
		// Absent key surfaces as a clear tool error from the plugin itself.
	}
}

export { default } from "/Users/lotar/.pi/agent/npm/node_modules/pi-tinyfish/index.ts";
