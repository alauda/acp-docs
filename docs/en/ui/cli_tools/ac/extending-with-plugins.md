---
weight: 50
---

# Extending ACP CLI with Plugins

You can write and install plugins to build on the default ac commands, allowing you to perform new and more complex tasks with ACP CLI and ACP platform integration.

## Writing CLI Plugins

You can write a plugin for ACP CLI (ac) in any programming language or script that allows you to write command-line commands. Note that you cannot use a plugin to overwrite an existing ac command.

### Creating a Simple Plugin

This procedure creates a simple Bash plugin that prints a message to the terminal when the `ac foo` command is issued.

**Procedure**

1. Create a file called `ac-foo`. When naming your plugin file, keep the following in mind:

   - The file must begin with `ac-` or `kubectl-` to be recognized as a plugin
   - The file name determines the command that invokes the plugin. For example, a plugin with the file name `ac-foo-bar` can be invoked by a command of `ac foo bar`
   - You can also use underscores if you want the command to contain dashes. For example, a plugin with the file name `ac-foo_bar` can be invoked by a command of `ac foo-bar`

2. Add the following contents to the file:

   ```bash
   #!/bin/bash
   
   # Optional argument handling
   if [[ "$1" == "version" ]]; then
       echo "1.0.0"
       exit 0
   fi
   
   # Optional argument handling
   if [[ "$1" == "config" ]]; then
       echo $KUBECONFIG
       exit 0
   fi
   
   echo "I am a plugin named ac-foo"
   ```

   After you install this plugin for ACP CLI, it can be invoked using the `ac foo` command.

### Plugin Development Requirements

- **Programming Language**: Use any programming language or script that supports command-line interfaces
- **Naming Convention**: Plugin files must follow the `ac-<plugin-name>` or `kubectl-<plugin-name>` naming pattern
- **Executable**: Plugin files must have executable permissions
- **Command Overrides**: Plugins cannot overwrite existing ACP CLI commands
- **Argument Handling**: Plugins should handle standard command-line arguments and flags appropriately

### Additional Resources

- Review kubectl plugin development guides for implementation patterns and best practices
- Use CLI runtime utilities for Go-based plugin development
- Consider ACP platform integration when designing plugins that interact with cluster resources

## Installing and Using CLI Plugins

After you write a custom plugin for ACP CLI, you must install the plugin before use.

### Prerequisites

- You must have ACP CLI (ac) installed
- You must have a CLI plugin file that begins with `ac-` or `kubectl-`

### Installation Procedure

1. If necessary, update the plugin file to be executable:

   ```bash
   chmod +x <plugin_file>
   ```

2. Place the file anywhere in your PATH, such as `/usr/local/bin/`:

   ```bash
   sudo mv <plugin_file> /usr/local/bin/
   ```

3. Run `ac plugin list` to make sure that the plugin is listed:

   ```bash
   ac plugin list
   ```

   **Example output**

   ```
   The following compatible plugins are available:

   /usr/local/bin/<plugin_file>
   ```

   If your plugin is not listed here, verify that the file begins with `ac-` or `kubectl-`, is executable, and is on your PATH.

4. Invoke the new command or option introduced by the plugin.

   For example, if you built and installed the `ac-ns` plugin, you can use the following command to view the current namespace:

   ```bash
   ac ns
   ```

   Note that the command to invoke the plugin depends on the plugin file name. For example, a plugin with the file name of `ac-foo-bar` is invoked by the `ac foo bar` command.