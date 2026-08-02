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

The repository now includes the local application foundation: a CLI, Fastify
server, React client, repeatable Git-backed sample project, and automated
verification. The analyzer and interactive graph are intentionally not
included yet.

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

Create a disposable sample repository. The script commits a clean baseline,
then modifies one source file so future change-analysis work has a predictable
target:

```sh
npm run playground
```

Start the local server and Vite client:

```sh
npm run dev
```

The browser opens at `http://127.0.0.1:5173`. To point the development app at
another local project:

```sh
npm run dev -- /absolute/path/to/project
```

Run the same checks used in CI:

```sh
npm run verify
```

The generated `.playground/` directory is disposable and ignored by Git. The
fixture template in `test-projects/` is versioned.

## Privacy

Code Atlas is designed to analyze repositories locally. Source code will not
be uploaded or sent to a hosted service.

## License

[MIT](LICENSE)
