# Private library extensions

Drop a `.ts` module here to add operator categories that stay on this machine.

Each file must `export default` a `LibraryExtension` (`categories`, `operators`, optional `rules` / `globals`). `import.meta.glob` loads `./private/*.ts` and the companion submodule `@private/library/*.ts` at build time and merges them (duplicate categories are kept once). Modules without a default export are ignored (with a console warning).

This folder is gitignored except this README. The Git-backed copy of our own tools lives in the private repository mounted at `/private` (submodule). A public clone never ships the extra operators.
