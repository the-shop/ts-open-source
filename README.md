# The Shop · Open Source

Public tools and practices from The Shop. This repository pins independently maintained projects as Git submodules so a checkout identifies the exact versions that were tested together.

## Projects

| Project | Purpose | Repository |
| --- | --- | --- |
| osx-window-manager | Menu-bar macOS window tiling; unmaintained AI experiment (macOS 14+, Apple Silicon) | [the-shop/osx-window-manager](https://github.com/the-shop/osx-window-manager) |
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

The workspace pins `ts-skills` and `osx-window-management` as Git submodules. Each can also be cloned independently from its repository above.

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

The parent documentation is [MIT-licensed](LICENSE). Each child project carries its own license; both TS Skills and osx-window-manager are MIT-licensed.
