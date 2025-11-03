---
weight: 20
---

# Configuring ACP CLI

## Shell Completion

You can enable tab completion for the Bash or Zsh shells.

### Enabling Tab Completion for Bash

After you install ACP CLI (ac), you can enable tab completion to automatically complete ac commands or suggest options when you press Tab. The following procedure enables tab completion for the Bash shell.

#### Prerequisites

- You must have ACP CLI (ac) installed.
- You must have the package bash-completion installed.

#### Procedure

1. Save the Bash completion code to a file:
   ```bash
   $ ac completion bash > ac_bash_completion
   ```

2. Copy the file to `/etc/bash_completion.d/`:
   ```bash
   $ sudo cp ac_bash_completion /etc/bash_completion.d/
   ```
   
   You can also save the file to a local directory and source it from your .bashrc file instead.

Tab completion is enabled when you open a new terminal.

### Enabling Tab Completion for Zsh

After you install ACP CLI (ac), you can enable tab completion to automatically complete ac commands or suggest options when you press Tab. The following procedure enables tab completion for the Zsh shell.

#### Prerequisites

You must have ACP CLI (ac) installed.

#### Procedure

To add tab completion for ac to your .zshrc file, run the following command:

```bash
cat >>~/.zshrc<<EOF
autoload -Uz compinit
compinit
if [[ $commands[ac] ]]; then
  source <(ac completion zsh)
  compdef _ac ac
fi
EOF
```

Tab completion is enabled when you open a new terminal.

## Accessing kubeconfig by using ACP CLI

You can use ACP CLI (ac) to log in to your ACP platform and retrieve a kubeconfig file for accessing clusters from the command line. Unlike traditional single-cluster kubeconfig exports, ac login creates a comprehensive multi-cluster configuration through platform discovery.

### Prerequisites

You have access to an ACP platform endpoint and valid authentication credentials.

### Procedure

1. Log in to your ACP platform by running the following command:
   ```bash
   $ ac login <platform-url> --name <session-name>
   ```
   
   - `<platform-url>`: The base URL of the ACP platform (e.g., https://acp.prod.example.com)
   - `<session-name>`: A user-defined friendly name for this platform connection (e.g., "prod", "staging")

2. The login process automatically:
   - Authenticates with the ACP platform
   - Discovers all accessible clusters in the platform  
   - Creates kubeconfig entries for all clusters with ACP-specific metadata
   - Sets up a default context pointing to the global cluster

3. To export the configuration to a separate file, run:
   ```bash
   $ ac config view --raw > kubeconfig
   ```

4. Set the KUBECONFIG environment variable to point to the exported file:
   ```bash
   $ export KUBECONFIG=./kubeconfig
   ```

5. Use ac to interact with your ACP clusters:
   ```bash
   $ ac get nodes
   ```

### Multi-Cluster Configuration Handling

ACP CLI login process creates a comprehensive kubeconfig structure that includes:

- **Multiple cluster entries**: One for each accessible cluster in the platform
- **Session metadata**: Platform URL, session name, and cluster descriptions stored in extension fields  
- **Unified authentication**: Single user credential entry that works across all clusters in the platform
- **Intelligent naming**: Conflict-free naming conventions using `acp:<session>:<cluster>` format

### Security Considerations

**Important**: The exported kubeconfig file contains authentication tokens that provide access to your ACP platform clusters.

- Store the file securely with appropriate file permissions
- Never commit kubeconfig files to version control systems
- Consider the token expiration and refresh requirements
- Use different session names for different environments (prod, staging, dev) to maintain clear separation

If you plan to reuse the exported kubeconfig file across sessions or machines, ensure it is stored securely and regularly synchronized with `ac config sync` to maintain current cluster lists.