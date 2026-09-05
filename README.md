# The Shop · Open Source

Public tools and practices from The Shop. This repository pins independently maintained projects as Git submodules so a checkout identifies the exact versions that were tested together.

## Projects

| Project | Purpose | Repository |
| --- | --- | --- |
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

The workspace contains `ts-skills` as a pinned Git submodule, not a copied directory. You can also clone [ts-skills](https://github.com/the-shop/ts-skills) independently.

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

The parent documentation is [MIT-licensed](LICENSE). Each child project carries its own license; TS Skills is also MIT-licensed.
