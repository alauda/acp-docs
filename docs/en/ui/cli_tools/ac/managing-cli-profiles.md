---
weight: 40
---

# Managing CLI Profiles

A CLI configuration file allows you to configure different profiles, or contexts, for use with ACP CLI (ac). A context consists of user authentication and ACP platform server information associated with a nickname.

## Convenient Configuration Management

ACP CLI provides enhanced commands that make configuration management much easier than traditional kubeconfig manipulation. These commands are designed to work seamlessly with ACP's multi-cluster environment.

### Platform and Session Management

#### `ac login` - Authenticate and configure access to ACP platforms

The `ac login` command serves as the primary entry point for establishing connections to ACP platforms. It authenticates users and automatically configures all necessary kubeconfig entries.

```bash
# Interactive login to an ACP platform
ac login https://prod.acp.com --name prod

# Login with specific cluster and namespace
ac login https://prod.acp.com --name prod --cluster workload-a --namespace my-app

# Login with environment variables (for automation)
AC_LOGIN_PLATFORM_URL=https://prod.acp.com AC_LOGIN_SESSION=prod AC_LOGIN_USERNAME=user AC_LOGIN_PASSWORD=secret ac login
```

The login process:
1. Authenticates against the ACP platform
2. Discovers all accessible clusters within the platform
3. Creates cluster and user entries in your kubeconfig
4. Creates and activates a context:
   - If `--cluster` is specified: creates context for that specific cluster
   - If `--namespace` is specified: sets the namespace in the context
   - If no cluster is specified: defaults to the global cluster
   - Context name follows pattern: `<session_name>/<cluster_name>`

#### `ac logout` - End platform sessions and clean up configuration

```bash
# Log out from current platform session
ac logout

# Log out from a specific session
ac logout --session prod
```

The logout command removes all session-related configuration entries including clusters, users, and contexts.

#### `ac config get-sessions` - List all configured ACP platform sessions

```bash
ac config get-sessions
```

Example output:
```
CURRENT   SESSION    PLATFORM                              USER                  CLUSTERS
*         prod       https://acp.prod.example.com          user@example.com      3
          staging    https://staging.acp.example.com       user@example.com      2
          dev        https://dev.acp.example.com           dev-user@example.com  1
```

This command displays:
- **CURRENT**: Indicates if the current context belongs to this session (marked with `*`)
- **SESSION**: Session name (user-defined during login)
- **PLATFORM**: Base platform URL
- **USER**: Authenticated username for the session
- **CLUSTERS**: Number of clusters available in this session

#### `ac config use-session <session_name>` - Switch between ACP platforms

```bash
# Switch to staging platform (defaults to global cluster)
ac config use-session staging

# Switch to specific cluster within a session
ac config use-session prod --cluster workload-a

# Switch with namespace specification
ac config use-session staging --cluster workload-b --namespace my-app
```

This command intelligently selects or creates appropriate contexts based on your session and cluster requirements.

### Daily Operations

#### `ac config use-cluster <cluster_name>` - Switch clusters within current session

```bash
# Switch to workload cluster within current session
ac config use-cluster workload-a

# Create new context with specific namespace
ac config use-cluster workload-b --namespace my-app
```

This command finds or creates contexts for the specified cluster within your current platform session.

#### `ac namespace` - View current status and switch namespaces

Display current status:
```bash
ac namespace
```

Example output:
```
You are currently in namespace "my-app-dev".

Context:   prod/workload-a
Cluster:   acp:prod:workload-a
Server:    https://acp.prod.example.com/kubernetes/workload-a/
Platform:  https://acp.prod.example.com/
Session:   prod
```

Switch namespace:
```bash
ac namespace my-app-dev
```

#### `ac config sync` - Synchronize platform configuration

```bash
# Sync current platform session
ac config sync

# Sync specific session
ac config sync --session prod

# Sync all sessions
ac config sync --all
```

The sync command refreshes your configuration with the latest information from ACP platforms, adding new clusters and updating credentials as needed.

## Understanding ACP CLI Configuration Structure

ACP CLI stores all configuration information in the standard `~/.kube/config` file, ensuring full compatibility with kubectl and other Kubernetes tools while adding ACP-specific enhancements.

### ACP CLI-Enhanced kubeconfig Structure

ACP CLI extends the standard kubeconfig format with ACP-specific metadata for enhanced platform integration:

```yaml
apiVersion: v1
clusters:
- cluster:
    server: https://acp.prod.example.com/kubernetes/global/
    extensions:
    - name: acp.io/v1
      extension:
        isGlobal: true
        platformUrl: https://acp.prod.example.com
        sessionName: prod
        clusterName: global
        description: global cluster
        note: This cluster item is managed by ac CLI, to avoid unexpected behavior, do not edit this item.
  name: acp:prod:global
- cluster:
    server: https://acp.prod.example.com/kubernetes/workload-a/
    extensions:
    - name: acp.io/v1
      extension:
        isGlobal: false
        platformUrl: https://acp.prod.example.com
        sessionName: prod
        clusterName: workload-a
        description: business cluster for team alpha
        note: This cluster item is managed by ac CLI, to avoid unexpected behavior, do not edit this item.
  name: acp:prod:workload-a
contexts:
- context:
    cluster: acp:prod:global
    namespace: default
    user: acp:prod:user
  name: prod/global
- context:
    cluster: acp:prod:workload-a
    namespace: my-app
    user: acp:prod:user
  name: prod/workload-a
current-context: prod/global
kind: Config
preferences: {}
users:
- name: acp:prod:user
  user:
    token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
    extensions:
    - name: acp.io/v1
      extension:
        platformUrl: https://acp.prod.example.com
        sessionName: prod
        username: user@example.com
        note: This user item is managed by ac CLI, to avoid unexpected behavior, do not edit this item.
```

### Metadata Structure and Organization

ACP CLI uses extension metadata to organize and identify configuration entries:

#### Metadata-Based Identification
- **Platform Identification**: Uses `platformUrl` to identify the parent platform
- **Session Association**: Uses `sessionName` to group related clusters, users, and contexts
- **Global Cluster Detection**: Uses `isGlobal` field to identify management clusters
- **User Credential Location**: Matches `sessionName` and `platformUrl` in user extensions

#### Naming Conventions
ACP CLI uses consistent naming conventions when creating new entries:
- **Cluster entries**: `acp:<session_name>:<cluster_name>` (e.g., `acp:prod:global`)
- **User entries**: `acp:<session_name>:user` (e.g., `acp:prod:user`)
- **Context entries**: `<session_name>/<cluster_name>` (e.g., `prod/global`)

:::note
The `acp:` prefix ensures ACP CLI-managed entries don't conflict with existing kubeconfig entries.
Users can manually rename these entries - ACP CLI uses metadata for identification, not names.
:::

## Manual Configuration of CLI Profiles

For advanced users who need precise control over configuration, ACP CLI supports all standard kubectl config commands for manual kubeconfig management.

:::tip
Most users should use the convenient commands described above.

Manual configuration commands are useful for advanced scenarios:

- **Custom context naming** - Creating contexts that don't follow ACP CLI naming conventions
- **Non-ACP environments** - Managing traditional kubectl contexts alongside ACP sessions
- **Complex multi-context scenarios** - Advanced workflows requiring precise context control
- **Troubleshooting configuration issues** - Debugging or repairing configuration problems
:::

### Standard Configuration Commands

ACP CLI provides full compatibility with kubectl config subcommands:

| Subcommand | Usage |
|------------|--------|
| `set-cluster` | Sets a cluster entry in the CLI config file |
| `set-context` | Sets a context entry in the CLI config file |
| `use-context` | Sets the current context using the specified context name |
| `set` | Sets an individual value in the CLI config file |
| `unset` | Unsets individual values in the CLI config file |
| `view` | Displays the merged CLI configuration currently in use |

### Example Manual Operations

Create a custom context:
```bash
# Create context with custom naming
ac config set-context my-custom-context --cluster=acp:prod:workload-a --namespace=my-app

# Switch to the custom context
ac config use-context my-custom-context
```

View current configuration:
```bash
# Display merged configuration
ac config view

# Display configuration from specific file
ac config view --config=/path/to/config
```

Update context namespace:
```bash
# Set namespace for current context
ac config set-context `ac config current-context` --namespace=my-namespace
```

## Load and Merge Rules

You can follow these rules when issuing CLI operations for the loading and merging order for the CLI configuration:

- CLI config files are retrieved from your workstation, using the following hierarchy and merge rules:
  - If the `--config` option is set, then only that file is loaded. The flag is set once and no merging takes place.
  - If the `$KUBECONFIG` environment variable is set, then it is used. The variable can be a list of paths, and if so the paths are merged together. When a value is modified, it is modified in the file that defines the stanza. When a value is created, it is created in the first file that exists. If no files in the chain exist, then it creates the last file in the list.
  - Otherwise, the `~/.kube/config` file is used and no merging takes place.

- The context to use is determined based on the first match in the following flow:
  - The value of the `--context` option.
  - The `current-context` value from the CLI config file.
  - An empty value is allowed at this stage.

- The user and cluster to use is determined. At this point, you may or may not have a context; they are built based on the first match in the following flow, which is run once for the user and once for the cluster:
  - The value of the `--user` for user name and `--cluster` option for cluster name.
  - If the `--context` option is present, then use the context's value.
  - An empty value is allowed at this stage.

- The actual cluster information to use is determined. At this point, you may or may not have cluster information. Each piece of the cluster information is built based on the first match in the following flow:
  - The values of any of the following command-line options: `--server`, `--api-version`, `--certificate-authority`, `--insecure-skip-tls-verify`
  - If cluster information and a value for the attribute is present, then use it.
  - If you do not have a server location, then there is an error.

- The actual user information to use is determined. Users are built using the same rules as clusters, except that you can only have one authentication technique per user; conflicting techniques cause the operation to fail. Command-line options take precedence over config file values. Valid command-line options are:
  - `--auth-path`
  - `--client-certificate`
  - `--client-key`
  - `--token`

- For any information that is still missing, default values are used and prompts are given for additional information.
