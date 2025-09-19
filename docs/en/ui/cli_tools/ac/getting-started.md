---
weight: 10
---

# Getting Started with ACP CLI

## About ACP CLI

With ACP CLI (ac), you can manage ACP platforms and clusters from a terminal. ACP CLI provides a kubectl-like experience optimized for ACP's centralized, proxy-based multi-cluster architecture.

ACP CLI is ideal in the following situations:

- Working with ACP platforms and multiple clusters from a unified interface
- Working directly with project source code Scripting ACP platform operations and automating workflows 
- Managing projects while restricted by bandwidth resources and the web console is unavailable
- Managing applications across different ACP environments (production, staging, development)

## Installation

### Installing from Binary

You can install ACP CLI (ac) by downloading the binary for your operating system.

#### Installing ACP CLI on Linux

1. Download the latest ACP CLI binary for Linux from your ACP platform administrator or release repository
2. Extract the binary:
   ```bash
   tar xvf ac-linux-amd64.tar.gz
   ```
3. Move the `ac` binary to a directory in your PATH:
   ```bash
   sudo mv ac /usr/local/bin/
   ```
4. Verify the installation:
   ```bash
   ac version
   ```

#### Installing ACP CLI on macOS

1. Download the latest ACP CLI binary for macOS from your ACP platform administrator or release repository
2. Extract the binary:
   ```bash
   tar xvf ac-darwin-amd64.tar.gz
   ```
3. Move the `ac` binary to a directory in your PATH:
   ```bash
   sudo mv ac /usr/local/bin/
   ```
4. Verify the installation:
   ```bash
   ac version
   ```

#### Installing ACP CLI on Windows

1. Download the latest ACP CLI binary for Windows from your ACP platform administrator or release repository
2. Extract the archive using your preferred ZIP utility
3. Move the `ac.exe` binary to a directory in your PATH
4. Verify the installation:
   ```cmd
   ac version
   ```

## First Steps

### Logging into ACP Platform

The `ac login` command is your entry point for connecting to ACP platforms. It handles authentication and automatically configures access to all available clusters.

#### Interactive Login

For the simplest experience, run `ac login` without parameters and follow the interactive prompts:

```bash
$ ac login
Platform URL: https://prod.acp.com
Session name: prod
Username: user@example.com
Password: [hidden]
✔ Login successful. Welcome, user@example.com!

Your kubeconfig has been configured for the 'prod' platform.
+ Default context 'prod/global' has been created and activated.

To switch clusters within this session, use:
  ac config use-cluster <cluster_name>

To switch between platforms, use:
  ac config get-sessions          # Discover all configured sessions
  ac config use-session <name>    # Switch to different platform
```

#### Login Using Parameters

You can also provide parameters directly:

```bash
ac login https://prod.acp.com --name prod --username user@example.com
```

#### Login Using Environment Variables

For automation and scripting, use environment variables:

```bash
export AC_LOGIN_PLATFORM_URL=https://prod.acp.com
export AC_LOGIN_SESSION=prod
export AC_LOGIN_USERNAME=user@example.com
export AC_LOGIN_PASSWORD=your-password
ac login
```

### Quick Configuration Management

Once logged in, ACP CLI provides convenient commands for daily operations:

#### View Current Status

Use `ac namespace` to see your current operational context:

```bash
$ ac namespace
You are currently in namespace "default" (no namespace set in context).

Context:   prod/global
Cluster:   acp:prod:global
Server:    https://acp.prod.example.com/kubernetes/global/
```

#### Switch Clusters

Switch between clusters within your current session:

```bash
$ ac config use-cluster workload-a
Switched to context "prod/workload-a".

$ ac config use-cluster global
Switched to context "prod/global".
```

#### Switch Namespaces

Change your active namespace:

```bash
$ ac namespace my-app-dev
Now using namespace "my-app-dev" in context "prod/global".
```

#### Basic Resource Operations

Use standard kubectl commands to manage resources:

```bash
# List pods in current namespace
$ ac get pods

# Describe a specific pod
$ ac describe pod my-pod

# Get services across all namespaces
$ ac get services --all-namespaces

# Apply a configuration file
$ ac apply -f deployment.yaml
```

#### Managing Multiple Environments

For users working with multiple ACP platforms:

List all configured sessions:

```bash
$ ac config get-sessions
CURRENT   SESSION    PLATFORM                              USER                  CLUSTERS
*         prod       https://acp.prod.example.com          user@example.com      3
          staging    https://staging.acp.example.com       user@example.com      2
```

Switch between platforms:

```bash
$ ac config use-session staging
Switched to session "staging".
Context "staging/global" activated.
```

### Your First Application

Let's create and view a simple application to verify everything is working:

#### Create a Simple Pod

1. Create a basic pod configuration:
   ```bash
   cat > test-pod.yaml << EOF
   apiVersion: v1
   kind: Pod
   metadata:
     name: test-pod
     labels:
       app: test
   spec:
     containers:
     - name: nginx
       image: nginx:1.20
       ports:
       - containerPort: 80
   EOF
   ```

2. Apply the configuration:
   ```bash
   $ ac apply -f test-pod.yaml
   pod/test-pod created
   ```

#### View Application Status

1. List pods to see your application:
   ```bash
   $ ac get pods
   NAME       READY   STATUS    RESTARTS   AGE
   test-pod   1/1     Running   0          30s
   ```

2. Get detailed information about the pod:
   ```bash
   $ ac describe pod test-pod
   ```

3. View pod logs:
   ```bash
   $ ac logs test-pod
   ```

#### Clean Up

Remove the test pod when finished:
```bash
ac delete -f test-pod.yaml
```

## Getting Help

### Built-in Help System

ACP CLI provides comprehensive help at multiple levels:

#### General Help

Get an overview of all available commands:
```bash
ac help
```

#### Command-Specific Help

Get detailed help for any specific command:
```bash
ac login --help
ac config --help
ac get --help
```

#### Resource Documentation

Get information about Kubernetes resources:
```bash
ac explain pod
ac explain deployment
ac explain service
```

## Logging Out

When you're finished working or need to switch to different credentials, use the logout command:

```bash
$ ac logout
✔ Successfully logged out from 'prod' platform.

All session configurations have been removed.
To reconnect, run: ac login https://prod.acp.com --name prod
```

The logout command:
- Removes authentication tokens from your local configuration
- Cleans up all cluster and context entries for the session
- Revoke currently used tokens in the ACP
- Ensures no orphaned configuration remains