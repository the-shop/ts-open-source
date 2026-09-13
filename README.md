# The Shop · Open Source

Public tools and practices from The Shop. This repository pins independently maintained projects as Git submodules so a checkout identifies the exact versions that were tested together.

## Projects

| Project | Purpose | Repository |
| --- | --- | --- |
| DOOM-Mac | Original Doom-style FPS in C for macOS, with procedural assets | [the-shop/doom-mac](https://github.com/the-shop/doom-mac) |
| osx-window-manager | Menu-bar macOS window tiling; unmaintained AI experiment (macOS 14+, Apple Silicon) | [the-shop/osx-window-manager](https://github.com/the-shop/osx-window-manager) |
| pi-browser-search | Headless-browser web search for the pi coding agent; Google/DuckDuckGo fan-out, no API keys | [the-shop/pi-browser-search](https://github.com/the-shop/pi-browser-search) |
| pi-the-shop | Performance counters, run time, and message timestamps for the pi coding agent | [the-shop/pi-the-shop](https://github.com/the-shop/pi-the-shop) |
| TS Skills | Eight portable engineering discipline skills with TOON references | [the-shop/ts-skills](https://github.com/the-shop/ts-skills) |

To install skills directly, use the child repository:

```sh
npx skills add the-shop/ts-skills
```

## Clone the workspace

```sh
git clone --recurse-submodules https://github.com/the-shop/ts-open-source.git
cd ts-open-source
```

If you already cloned without submodules:

```sh
git submodule update --init --recursive
```

The workspace pins `ts-skills`, `osx-window-management`, `doom-mac`, `pi-the-shop`, and `pi-browser-search` as Git submodules. Each can also be cloned independently from its repository above.

## macOS window manager

The `osx-window-management` directory contains [osx-window-manager](https://github.com/the-shop/osx-window-manager). See its [README](osx-window-management/README.md) for installation, Accessibility permission, shortcuts, and Launch at Login; the [site and demo](https://the-shop.github.io/osx-window-manager/) and [changelog](osx-window-management/CHANGELOG.md) cover features and history.

On Apple Silicon with macOS 14 or newer, open the packaged app from this workspace:

```sh
open osx-window-management/dist/osx-window-manager.app
```

To validate a source build on macOS:

```sh
cd osx-window-management
swift build
python3 scripts/matrix_test.py
```

The window manager remains an unmaintained AI experiment. Its existing bundle identifier and settings are preserved. The former personal repository now points to the canonical The Shop repository.

## DOOM-Mac

The `doom-mac` submodule contains an original C game with procedurally generated assets. See its [README](doom-mac/README.md) for controls and known limitations, or download the Apple Silicon binaries (macOS 12+) from [Releases](https://github.com/the-shop/doom-mac/releases).

To build and run its headless tests on macOS:

```sh
cd doom-mac
brew install sdl2
make
make test
```

## pi-the-shop

The `pi-the-shop` submodule contains a pi coding-agent extension for time to first token, tokens per second, total run time, and message timestamps. See its [README](pi-the-shop/README.md) for `/ts-settings` toggles and `/ts-stats`.

Install the published package:

```sh
pi install npm:pi-the-shop
```

To try the pinned workspace checkout, run from the workspace root:

```sh
pi -e ./pi-the-shop/index.ts
```

## pi-browser-search

The `pi-browser-search` submodule contains the headless-browser web search
extension for the pi coding agent: Google and DuckDuckGo fan-out with no API
keys. It needs Chrome and Node.js 22 or newer. See its
[README](pi-browser-search/README.md) for engine behaviour, the Google trust
import, and the test suite.

Install the child repository:

```sh
pi install git:github.com/the-shop/pi-browser-search
```

To try the pinned workspace checkout instead, run from the workspace root:

```sh
pi -e ./pi-browser-search/index.ts
```

The design record and the measurements behind the engine decisions are in
[browser-search-plan.md](browser-search-plan.md) — historical, kept as evidence.

### Research agents

`.pi/agents/` carries two project-local pi subagents used to compare search
backends: `web-researcher` (this repo's `ts_web_search`/`ts_fetch_content`) and
`tf-researcher` (TinyFish). Both load their provider only into the child
session. `tf-researcher` needs `TINYFISH_API_KEY`, which
[`.pi/tinyfish-env.ts`](.pi/tinyfish-env.ts) reads from
`~/.pi/agent/secrets/tinyfish.env` (chmod 600, outside this repository — see the
secret-scan below). Without it the tools fail with the SDK's own missing-key
error.

## Validate the pinned skills

```sh
cd ts-skills
npm ci --ignore-scripts
npm run check
```

Node.js 20 or newer is needed for these maintainer checks. Using the skill instructions requires only a compatible agent that can read their files. The child README documents installation, compatibility, examples, and release evidence.

## Update a submodule deliberately

From the parent checkout, select the child release you want to pin:

```sh
git -C ts-skills fetch origin --tags
git -C ts-skills checkout v0.1.0
git add ts-skills
git commit -m "Pin TS Skills v0.1.0"
```

Review local changes before switching the child checkout. Avoid automatically following a moving branch: the parent commit should identify a tested child commit. When pulling parent updates, run `git submodule update --init --recursive` afterward.

## License

The parent documentation is [MIT-licensed](LICENSE). Each child project carries its own license; TS Skills, osx-window-manager, DOOM-Mac, pi-the-shop, and pi-browser-search are MIT-licensed.
