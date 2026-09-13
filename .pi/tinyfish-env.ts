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
import { pathToFileURL } from "node:url";

if (!process.env.TINYFISH_API_KEY) {
	try {
		const file = join(homedir(), ".pi", "agent", "secrets", "tinyfish.env");
		const match = readFileSync(file, "utf8").match(/TINYFISH_API_KEY="([^"]+)"/);
		if (match?.[1]) process.env.TINYFISH_API_KEY = match[1];
	} catch {
		// Absent key surfaces as a clear tool error from the plugin itself.
	}
}

// Resolved from the home directory rather than an absolute path, so a clone on
// another machine finds its own install. `pi install npm:pi-tinyfish` puts the
// package here for any user. A dynamic import is required because a re-export
// (`export { default } from ...`) only accepts a string literal.
const plugin = join(homedir(), ".pi", "agent", "npm", "node_modules", "pi-tinyfish", "index.ts");
const { default: tinyfishPlugin } = await import(pathToFileURL(plugin).href);
export default tinyfishPlugin;
