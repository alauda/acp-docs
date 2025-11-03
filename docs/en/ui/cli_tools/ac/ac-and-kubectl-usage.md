---
weight: 30
---

# Usage of ac and kubectl Commands

The Kubernetes command-line interface (CLI), kubectl, can be used to run commands against a Kubernetes cluster. Because ACP is a Kubernetes-compatible platform, you can use the supported kubectl binaries that ship with ACP CLI, or you can gain extended functionality by using the ac binary.

## The ac Binary

The ac binary offers the same capabilities as the kubectl binary, but extends to natively support additional ACP platform features, including:

### ACP Platform Integration

ACP CLI provides built-in support for ACP's centralized, proxy-based multi-cluster architecture:

- **Platform Authentication** - Built-in login command for secure authentication with ACP platforms
- **Session Management** - Multi-platform session management with commands like `ac login`, `ac config use-session`, and `ac logout`
- **Enhanced Configuration** - Additional commands like `ac config use-cluster` that make it easier to work with ACP multi-cluster environments

### Intelligent Resource Routing

ACP CLI automatically routes platform-level resource types like `User` and `Project` to the global cluster, since these resources only exist at the platform level. This allows you to access them from any cluster context without manual switching. All other resources work normally with your current cluster context.

#### Resource Routing Example

```bash
# Current context points to workload cluster
$ ac config current-context
prod/workload-a

# User requests global resource - ACP CLI automatically routes to global cluster
$ ac get projects
(i) Note: Targeting global cluster for this command only, as 'projects' is a global resource.
NAME          STATUS   AGE
project-a     Active   32d
project-b     Active   18d

# User requests workload resource - operates on current cluster
$ ac get pods
NAME                     READY   STATUS    RESTARTS   AGE
my-app-7d4f8c9b6-xyz123  1/1     Running   0          2h
```

### Additional Commands

ACP CLI includes additional commands that simplify ACP platform workflows:

- `ac login` - Authenticate to ACP platforms and configure multi-cluster access
- `ac logout` - End platform sessions and clean up configuration
- `ac config get-sessions` - List all configured ACP platform sessions
- `ac config use-session <session_name>` - Switch between ACP platforms
- `ac config use-cluster <cluster_name>` - Switch clusters within current session
- `ac namespace` - Enhanced namespace management with platform context display
- `ac config sync` - Synchronize configuration with platform state

## The kubectl Binary

The kubectl binary is provided as a means to support existing workflows and scripts for new ACP CLI users coming from a standard Kubernetes environment, or for those who prefer to use the kubectl CLI. Existing users of kubectl can continue to use the binary to interact with Kubernetes primitives, with no changes required to the ACP platform.

For more information about kubectl, see the [kubectl documentation](https://kubernetes.io/docs/reference/kubectl/).