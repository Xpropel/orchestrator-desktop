# Private library extensions

Drop a `.ts` module here to add operator categories that stay on this machine.

Each file must `export default` a `LibraryExtension` (`categories`, `operators`, optional `rules` / `globals`). `import.meta.glob('./private/*.ts')` loads every match at build time and merges it into the public library. Modules without a default export are ignored (with a console warning).

This folder is gitignored except this README, so a public clone never ships the extra operators.
