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

The `0.0.1` package provides the `code-atlas` command and project help. The
analyzer and interactive graph are not included yet.

```sh
npx @dububu/code-atlas --help
```

For repeat use, install the package globally and use the shorter executable:

```sh
npm install --global @dububu/code-atlas
code-atlas .
```

## Privacy

Code Atlas is designed to analyze repositories locally. Source code will not
be uploaded or sent to a hosted service.

## License

[MIT](LICENSE)
