## Documentation Dependencies

* Ensure that [Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/) are installed locally
* Use `yarn` to install dependencies

```bash
$ yarn install
```

* It's recommended to use [Visual Studio Code](https://code.visualstudio.com/) editor and install the [MDX](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx) extension for document writing

## Documentation Quick Start

* `yarn dev`: Start the local development server, file modifications will update in real-time. (**Note:** Left navigation bar related modifications require restarting the service)
* `yarn build`: Build production environment code, static files will be generated in the `dist` directory after build completion
* `yarn serve`: Preview the built static files locally
