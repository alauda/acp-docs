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
* `yarn up @alauda/doom`: Upgrade doom

## Updating AC CLI Documentation

The AC CLI documentation in [docs/en/ui/cli_tools/ac/](docs/en/ui/cli_tools/ac/) is generated from the AC repository and should be updated through the sync script instead of manual edits.

### Prerequisites

* Install project dependencies with `yarn install`
* Ensure `git` is available on your machine
* Ensure your account has SSH access to `git@gitlab-ce.alauda.cn:alauda/ac.git`

### Default Update Command

Run the standard update command from the repository root:

```bash
yarn update-ac-manual
```

This command runs:

```bash
node scripts/update-ac-manual.js release-1.0
```

When you use `yarn update-ac-manual`, the repository sync pulls the `release-1.0` branch from `git@gitlab-ce.alauda.cn:alauda/ac.git` because the project script explicitly passes that branch name.

### What the Sync Script Does

The update script uses the following locations:

* Source repository: `git@gitlab-ce.alauda.cn:alauda/ac.git`
* Temporary clone directory: `local/temp-ac-clone`
* Source manual directory inside the AC repository: `manual/`
* Target directory in this repository: `docs/en/ui/cli_tools/ac/`

The workflow is:

1. Clone the AC repository into `local/temp-ac-clone`
2. Read the `manual/` directory from the cloned repository
3. Remove all existing files under `docs/en/ui/cli_tools/ac/` except `index.mdx`
4. Copy the files from `manual/` into `docs/en/ui/cli_tools/ac/`
5. Strip leading numeric prefixes from top-level Markdown filenames such as `01_foo.md`
6. Remove the temporary clone directory after the sync finishes

### Updating from a Different Branch

If you need to sync from a branch other than `release-1.0`, run the script directly:

```bash
node scripts/update-ac-manual.js <branch>
```

Replace `<branch>` with the branch name you want to pull from.

If you run `node scripts/update-ac-manual.js` without a branch argument, the script itself defaults to `main`.

### Recommended Verification Steps

After updating the generated files, review and validate the result:

```bash
git diff -- docs/en/ui/cli_tools/ac
yarn lint
yarn build
```

If the English source changes need to be synchronized to localized content, run:

```bash
yarn translate
```

### Notes

* Do not manually edit files in [docs/en/ui/cli_tools/ac/](docs/en/ui/cli_tools/ac/); they are managed by the update script
* `index.mdx` in [docs/en/ui/cli_tools/ac/](docs/en/ui/cli_tools/ac/) is preserved by the sync process
* If local preview output changes in the sidebar or navigation, restart `yarn dev`
