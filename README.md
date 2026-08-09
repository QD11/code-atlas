# Code Atlas

Visualize how exported-symbol changes affect a JavaScript or TypeScript project.

> Code Atlas is in early development. The first public preview reserves the
> package and command name while the project graph and impact analyzer are
> being built in public.

## Planned usage

Run Code Atlas from the root of a Git repository:

```sh
npx @dububu/code-atlas .
```

Code Atlas will launch a local web application that shows the complete
JavaScript and TypeScript file-import graph, highlights changed exported
symbols, and traces their direct and potential downstream impact.

## Current preview

The local analysis backend is implemented. It discovers the full supported
project, resolves internal imports, compares the working tree with Git
`HEAD`, detects changed exported symbols, and calculates exact direct and
inferred transitive impact. The interactive graph UI is still under
development.

```sh
npx @dububu/code-atlas --help
```

For repeat use, install the package globally and use the shorter executable:

```sh
npm install --global @dububu/code-atlas
code-atlas .
```

## Development

Use Node.js 24 and install the dependencies:

```sh
npm install
```

Start the local server and Vite client. By default, Code Atlas analyzes its own
`web` directory so frontend changes appear in the graph as you build:

```sh
npm run dev
```

The browser opens at `http://127.0.0.1:5173`. To point the development app at
another local project:

```sh
npm run dev -- /absolute/path/to/project
```

To test against the disposable sample repository instead, create it and pass
its path explicitly:

```sh
npm run playground
npm run dev -- .playground/sample-project
```

The installed CLI serves the current analysis from `GET /api/snapshot` and
publishes revision-only live update notifications from `GET /api/events`.
These routes are an internal bridge to the browser UI: the server binds to
`127.0.0.1`, rejects non-loopback hosts and origins, accepts no filesystem
path from a request, and has no endpoint for raw source contents.

Run the same checks used in CI:

```sh
npm run verify
```

The generated `.playground/` directory is disposable and ignored by Git. The
fixture template in `test-projects/` is versioned.

## Privacy

Code Atlas is designed to analyze repositories locally. Source code will not
be uploaded or sent to a hosted service. Analysis snapshots contain project
paths, import/export metadata, change classifications, structural hashes, and
diagnostics—but not raw source text.

## License

[MIT](LICENSE)
