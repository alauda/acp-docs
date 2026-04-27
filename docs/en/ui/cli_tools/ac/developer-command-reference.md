---
weight: 60
---

# AC CLI Developer Command Reference

This reference provides descriptions and example commands for AC CLI developer commands. For administrator commands, see the AC CLI administrator command reference.

Run `ac help` to list all commands or run `ac <command> --help` to get additional details for a specific command.


## ac annotate

Update the annotations on a resource

### Example usage

```
# Update pod 'foo' with the annotation 'description' and the value 'my frontend'
# If the same annotation is set multiple times, only the last value will be applied
ac annotate pods foo description='my frontend'

# Update a pod identified by type and name in "pod.json"
ac annotate -f pod.json description='my frontend'

# Update pod 'foo' with the annotation 'description' and the value 'my frontend running nginx', overwriting any existing value
ac annotate --overwrite pods foo description='my frontend running nginx'

# Update all pods in the namespace
ac annotate pods --all description='my frontend running nginx'

# Update pod 'foo' only if the resource is unchanged from version 1
ac annotate pods foo description='my frontend running nginx' --resource-version=1

# Update pod 'foo' by removing an annotation named 'description' if it exists
# Does not require the --overwrite flag
ac annotate pods foo description-
```

## ac api-resources

Print the supported API resources on the server

### Example usage

```
# Print the supported API resources
ac api-resources

# Print the supported API resources with more information
ac api-resources -o wide

# Print the supported API resources sorted by a column
ac api-resources --sort-by=name

# Print the supported namespaced resources
ac api-resources --namespaced=true

# Print the supported non-namespaced resources
ac api-resources --namespaced=false

# Print the supported API resources with a specific APIGroup
ac api-resources --api-group=rbac.authorization.k8s.io
```

## ac api-versions

Print the supported API versions on the server, in the form of "group/version"

### Example usage

```
# Print the supported API versions
ac api-versions
```

## ac apply

Apply a configuration to a resource by file name or stdin

### Example usage

```
# Apply the configuration in pod.json to a pod
ac apply -f ./pod.json

# Apply resources from a directory containing kustomization.yaml - e.g. dir/kustomization.yaml
ac apply -k dir/

# Apply the JSON passed into stdin to a pod
cat pod.json | ac apply -f -

# Apply the configuration from all files that end with '.json'
ac apply -f '*.json'

# Note: --prune is still in Alpha
# Apply the configuration in manifest.yaml that matches label app=nginx and delete all other resources that are not in the file and match label app=nginx
ac apply --prune -f manifest.yaml -l app=nginx

# Apply the configuration in manifest.yaml and delete all the other config maps that are not in the file
ac apply --prune -f manifest.yaml --all --prune-allowlist=core/v1/ConfigMap
```

## ac apply edit-last-applied

Edit latest last-applied-configuration annotations of a resource/object

### Example usage

```
# Edit the last-applied-configuration annotations by type/name in YAML
ac apply edit-last-applied deployment/nginx

# Edit the last-applied-configuration annotations by file in JSON
ac apply edit-last-applied -f deploy.yaml -o json
```

## ac apply set-last-applied

Set the last-applied-configuration annotation on a live object to match the contents of a file

### Example usage

```
# Set the last-applied-configuration of a resource to match the contents of a file
ac apply set-last-applied -f deploy.yaml

# Execute set-last-applied against each configuration file in a directory
ac apply set-last-applied -f path/

# Set the last-applied-configuration of a resource to match the contents of a file; will create the annotation if it does not already exist
ac apply set-last-applied -f deploy.yaml --create-annotation=true
```

## ac apply view-last-applied

View the latest last-applied-configuration annotations of a resource/object

### Example usage

```
# View the last-applied-configuration annotations by type/name in YAML
ac apply view-last-applied deployment/nginx

# View the last-applied-configuration annotations by file in JSON
ac apply view-last-applied -f deploy.yaml -o json
```

## ac attach

Attach to a running container

### Example usage

```
# Get output from running pod mypod; use the 'ac.kubernetes.io/default-container' annotation
# for selecting the container to be attached or the first container in the pod will be chosen
ac attach mypod

# Get output from ruby-container from pod mypod
ac attach mypod -c ruby-container

# Switch to raw terminal mode; sends stdin to 'bash' in ruby-container from pod mypod
# and sends stdout/stderr from 'bash' back to the client
ac attach mypod -c ruby-container -i -t

# Get output from the first pod of a replica set named nginx
ac attach rs/nginx
```

## ac auth

Inspect authorization

## ac auth can-i

Check whether an action is allowed

### Example usage

```
# Check to see if I can create pods in any namespace
ac auth can-i create pods --all-namespaces

# Check to see if I can list deployments in my current namespace
ac auth can-i list deployments.apps

# Check to see if service account "foo" of namespace "dev" can list pods in the namespace "prod"
# You must be allowed to use impersonation for the global option "--as"
ac auth can-i list pods --as=system:serviceaccount:dev:foo -n prod

# Check to see if I can do everything in my current namespace ("*" means all)
ac auth can-i '*' '*'

# Check to see if I can get the job named "bar" in namespace "foo"
ac auth can-i list jobs.batch/bar -n foo

# Check to see if I can read pod logs
ac auth can-i get pods --subresource=log

# Check to see if I can access the URL /logs/
ac auth can-i get /logs/

# Check to see if I can approve certificates.k8s.io
ac auth can-i approve certificates.k8s.io

# List all allowed actions in namespace "foo"
ac auth can-i --list --namespace=foo
```

## ac auth reconcile

Reconciles rules for RBAC role, role binding, cluster role, and cluster role binding objects

### Example usage

```
# Reconcile RBAC resources from a file
ac auth reconcile -f my-rbac-rules.yaml
```

## ac auth whoami

Experimental: Check self subject attributes

### Example usage

```
# Get your subject attributes
ac auth whoami

# Get your subject attributes in JSON format
ac auth whoami -o json
```

## ac autoscale

Auto-scale a deployment, replica set, stateful set, or replication controller

### Example usage

```
# Auto scale a deployment "foo", with the number of pods between 2 and 10, no target CPU utilization specified so a default autoscaling policy will be used
ac autoscale deployment foo --min=2 --max=10

# Auto scale a replication controller "foo", with the number of pods between 1 and 5, target CPU utilization at 80%
ac autoscale rc foo --max=5 --cpu-percent=80
```

## ac cluster-info

Display cluster information

### Example usage

```
# Print the address of the control plane and cluster services
ac cluster-info
```

## ac cluster-info dump

Dump relevant information for debugging and diagnosis

### Example usage

```
# Dump current cluster state to stdout
ac cluster-info dump

# Dump current cluster state to /path/to/cluster-state
ac cluster-info dump --output-directory=/path/to/cluster-state

# Dump all namespaces to stdout
ac cluster-info dump --all-namespaces

# Dump a set of namespaces to /path/to/cluster-state
ac cluster-info dump --namespaces default,kube-system --output-directory=/path/to/cluster-state
```

## ac completion

Output shell completion code for the specified shell (bash, zsh, fish, or powershell)

### Example usage

```
# Installing bash completion on macOS using homebrew
## If running Bash 3.2 included with macOS
brew install bash-completion
## or, if running Bash 4.1+
brew install bash-completion@2
## If ac is installed via homebrew, this should start working immediately
## If you've installed via other means, you may need add the completion to your completion directory
ac completion bash > $(brew --prefix)/etc/bash_completion.d/ac


# Installing bash completion on Linux
## If bash-completion is not installed on Linux, install the 'bash-completion' package
## via your distribution's package manager.
## Load the ac completion code for bash into the current shell
source <(ac completion bash)
## Write bash completion code to a file and source it from .bash_profile
ac completion bash > ~/.kube/completion.bash.inc
printf "
# ac shell completion
source '$HOME/.kube/completion.bash.inc'
" >> $HOME/.bash_profile
source $HOME/.bash_profile

# Load the ac completion code for zsh[1] into the current shell
source <(ac completion zsh)
# Set the ac completion code for zsh[1] to autoload on startup
ac completion zsh > "${fpath[1]}/_ac"


# Load the ac completion code for fish[2] into the current shell
ac completion fish | source
# To load completions for each session, execute once:
ac completion fish > ~/.config/fish/completions/ac.fish

# Load the ac completion code for powershell into the current shell
ac completion powershell | Out-String | Invoke-Expression
# Set ac completion code for powershell to run on startup
## Save completion code to a script and execute in the profile
ac completion powershell > $HOME\.kube\completion.ps1
Add-Content $PROFILE "$HOME\.kube\completion.ps1"
## Execute completion code in the profile
Add-Content $PROFILE "if (Get-Command ac -ErrorAction SilentlyContinue) {
ac completion powershell | Out-String | Invoke-Expression
}"
## Add completion code directly to the $PROFILE script
ac completion powershell >> $PROFILE
```

## ac config

Modify kubeconfig files

## ac config current-context

Display the current-context

### Example usage

```
# Display the current-context
ac config current-context
```

## ac config delete-cluster

Delete the specified cluster from the kubeconfig

### Example usage

```
# Delete the minikube cluster
ac config delete-cluster minikube
```

## ac config delete-context

Delete the specified context from the kubeconfig

### Example usage

```
# Delete the context for the minikube cluster
ac config delete-context minikube
```

## ac config delete-user

Delete the specified user from the kubeconfig

### Example usage

```
# Delete the minikube user
ac config delete-user minikube
```

## ac config get-clusters

Display clusters defined in the kubeconfig

### Example usage

```
# List the clusters that ac knows about
ac config get-clusters
```

## ac config get-contexts

Describe one or many contexts

### Example usage

```
# List all the contexts in your kubeconfig file
ac config get-contexts

# Describe one context in your kubeconfig file
ac config get-contexts my-context
```

## ac config get-sessions

List all configured ACP platform sessions

### Example usage

```
# List all configured ACP sessions
ac config get-sessions
```

## ac config get-users

Display users defined in the kubeconfig

### Example usage

```
# List the users that ac knows about
ac config get-users
```

## ac config rename-context

Rename a context from the kubeconfig file

### Example usage

```
# Rename the context 'old-name' to 'new-name' in your kubeconfig file
ac config rename-context old-name new-name
```

## ac config set

Set an individual value in a kubeconfig file

### Example usage

```
# Set the server field on the my-cluster cluster to https://1.2.3.4
ac config set clusters.my-cluster.server https://1.2.3.4

# Set the certificate-authority-data field on the my-cluster cluster
ac config set clusters.my-cluster.certificate-authority-data $(echo "cert_data_here" | base64 -i -)

# Set the cluster field in the my-context context to my-cluster
ac config set contexts.my-context.cluster my-cluster

# Set the client-key-data field in the cluster-admin user using --set-raw-bytes option
ac config set users.cluster-admin.client-key-data cert_data_here --set-raw-bytes=true
```

## ac config set-cluster

Set a cluster entry in kubeconfig

### Example usage

```
# Set only the server field on the e2e cluster entry without touching other values
ac config set-cluster e2e --server=https://1.2.3.4

# Embed certificate authority data for the e2e cluster entry
ac config set-cluster e2e --embed-certs --certificate-authority=~/.kube/e2e/kubernetes.ca.crt

# Disable cert checking for the e2e cluster entry
ac config set-cluster e2e --insecure-skip-tls-verify=true

# Set the custom TLS server name to use for validation for the e2e cluster entry
ac config set-cluster e2e --tls-server-name=my-cluster-name

# Set the proxy URL for the e2e cluster entry
ac config set-cluster e2e --proxy-url=https://1.2.3.4
```

## ac config set-context

Set a context entry in kubeconfig

### Example usage

```
# Set the user field on the gce context entry without touching other values
ac config set-context gce --user=cluster-admin
```

## ac config set-credentials

Set a user entry in kubeconfig

### Example usage

```
# Set only the "client-key" field on the "cluster-admin"
# entry, without touching other values
ac config set-credentials cluster-admin --client-key=~/.kube/admin.key

# Set basic auth for the "cluster-admin" entry
ac config set-credentials cluster-admin --username=admin --password=uXFGweU9l35qcif

# Embed client certificate data in the "cluster-admin" entry
ac config set-credentials cluster-admin --client-certificate=~/.kube/admin.crt --embed-certs=true

# Enable the Google Compute Platform auth provider for the "cluster-admin" entry
ac config set-credentials cluster-admin --auth-provider=gcp

# Enable the OpenID Connect auth provider for the "cluster-admin" entry with additional arguments
ac config set-credentials cluster-admin --auth-provider=oidc --auth-provider-arg=client-id=foo --auth-provider-arg=client-secret=bar

# Remove the "client-secret" config value for the OpenID Connect auth provider for the "cluster-admin" entry
ac config set-credentials cluster-admin --auth-provider=oidc --auth-provider-arg=client-secret-

# Enable new exec auth plugin for the "cluster-admin" entry
ac config set-credentials cluster-admin --exec-command=/path/to/the/executable --exec-api-version=client.authentication.k8s.io/v1beta1

# Enable new exec auth plugin for the "cluster-admin" entry with interactive mode
ac config set-credentials cluster-admin --exec-command=/path/to/the/executable --exec-api-version=client.authentication.k8s.io/v1beta1 --exec-interactive-mode=Never

# Define new exec auth plugin arguments for the "cluster-admin" entry
ac config set-credentials cluster-admin --exec-arg=arg1 --exec-arg=arg2

# Create or update exec auth plugin environment variables for the "cluster-admin" entry
ac config set-credentials cluster-admin --exec-env=key1=val1 --exec-env=key2=val2

# Remove exec auth plugin environment variables for the "cluster-admin" entry
ac config set-credentials cluster-admin --exec-env=var-to-remove-
```

## ac config sync

Synchronize kubeconfig with ACP platform state

### Example usage

```
# Sync current session based on active context
ac config sync

# Sync specific session
ac config sync --session prod

# Sync all sessions
ac config sync --all
```

## ac config unset

Unset an individual value in a kubeconfig file

### Example usage

```
# Unset the current-context
ac config unset current-context

# Unset namespace in foo context
ac config unset contexts.foo.namespace
```

## ac config use-cluster

Switch to a specific ACP cluster by cluster name

### Example usage

```
# Switch to existing context for workload-a cluster
ac config use-cluster workload-a

# Create new context for workload-b with namespace
ac config use-cluster workload-b --namespace my-app

# Switch to global cluster
ac config use-cluster global
```

## ac config use-context

Set the current-context in a kubeconfig file

### Example usage

```
# Use the context for the minikube cluster
ac config use-context minikube
```

## ac config use-session

Switch to a specified ACP session with intelligent context selection

### Example usage

```
# Switch to staging session (default global cluster)
ac config use-session staging

# Switch to production session with specific cluster
ac config use-session prod --cluster workload-b

# Switch to session with specific cluster and namespace
ac config use-session staging --cluster workload-a --namespace my-app
```

## ac config view

Display merged kubeconfig settings or a specified kubeconfig file

### Example usage

```
# Show merged kubeconfig settings
ac config view

# Show merged kubeconfig settings, raw certificate data, and exposed secrets
ac config view --raw

# Get the password for the e2e user
ac config view -o jsonpath='{.users[?(@.name == "e2e")].user.password}'
```

## ac cp

Copy files and directories to and from containers

### Example usage

```
# !!!Important Note!!!
# Requires that the 'tar' binary is present in your container
# image.  If 'tar' is not present, 'ac cp' will fail.
#
# For advanced use cases, such as symlinks, wildcard expansion or
# file mode preservation, consider using 'ac exec'.

# Copy /tmp/foo local file to /tmp/bar in a remote pod in namespace <some-namespace>
tar cf - /tmp/foo | ac exec -i -n <some-namespace> <some-pod> -- tar xf - -C /tmp/bar

# Copy /tmp/foo from a remote pod to /tmp/bar locally
ac exec -n <some-namespace> <some-pod> -- tar cf - /tmp/foo | tar xf - -C /tmp/bar

# Copy /tmp/foo_dir local directory to /tmp/bar_dir in a remote pod in the default namespace
ac cp /tmp/foo_dir <some-pod>:/tmp/bar_dir

# Copy /tmp/foo local file to /tmp/bar in a remote pod in a specific container
ac cp /tmp/foo <some-pod>:/tmp/bar -c <specific-container>

# Copy /tmp/foo local file to /tmp/bar in a remote pod in namespace <some-namespace>
ac cp /tmp/foo <some-namespace>/<some-pod>:/tmp/bar

# Copy /tmp/foo from a remote pod to /tmp/bar locally
ac cp <some-namespace>/<some-pod>:/tmp/foo /tmp/bar
```

## ac create

Create a resource from a file or from stdin

### Example usage

```
# Create a pod using the data in pod.json
ac create -f ./pod.json

# Create a pod based on the JSON passed into stdin
cat pod.json | ac create -f -

# Edit the data in registry.yaml in JSON then create the resource using the edited data
ac create -f registry.yaml --edit -o json
```

## ac create clusterrole

Create a cluster role

### Example usage

```
# Create a cluster role named "pod-reader" that allows user to perform "get", "watch" and "list" on pods
ac create clusterrole pod-reader --verb=get,list,watch --resource=pods

# Create a cluster role named "pod-reader" with ResourceName specified
ac create clusterrole pod-reader --verb=get --resource=pods --resource-name=readablepod --resource-name=anotherpod

# Create a cluster role named "foo" with API Group specified
ac create clusterrole foo --verb=get,list,watch --resource=rs.apps

# Create a cluster role named "foo" with SubResource specified
ac create clusterrole foo --verb=get,list,watch --resource=pods,pods/status

# Create a cluster role name "foo" with NonResourceURL specified
ac create clusterrole "foo" --verb=get --non-resource-url=/logs/*

# Create a cluster role name "monitoring" with AggregationRule specified
ac create clusterrole monitoring --aggregation-rule="rbac.example.com/aggregate-to-monitoring=true"
```

## ac create clusterrolebinding

Create a cluster role binding for a particular cluster role

### Example usage

```
# Create a cluster role binding for user1, user2, and group1 using the cluster-admin cluster role
ac create clusterrolebinding cluster-admin --clusterrole=cluster-admin --user=user1 --user=user2 --group=group1
```

## ac create configmap

Create a config map from a local file, directory or literal value

### Example usage

```
# Create a new config map named my-config based on folder bar
ac create configmap my-config --from-file=path/to/bar

# Create a new config map named my-config with specified keys instead of file basenames on disk
ac create configmap my-config --from-file=key1=/path/to/bar/file1.txt --from-file=key2=/path/to/bar/file2.txt

# Create a new config map named my-config with key1=config1 and key2=config2
ac create configmap my-config --from-literal=key1=config1 --from-literal=key2=config2

# Create a new config map named my-config from the key=value pairs in the file
ac create configmap my-config --from-file=path/to/bar

# Create a new config map named my-config from an env file
ac create configmap my-config --from-env-file=path/to/foo.env --from-env-file=path/to/bar.env
```

## ac create cronjob

Create a cron job with the specified name

### Example usage

```
# Create a cron job
ac create cronjob my-job --image=busybox --schedule="*/1 * * * *"

# Create a cron job with a command
ac create cronjob my-job --image=busybox --schedule="*/1 * * * *" -- date
```

## ac create deployment

Create a deployment with the specified name

### Example usage

```
# Create a deployment named my-dep that runs the busybox image
ac create deployment my-dep --image=busybox

# Create a deployment with a command
ac create deployment my-dep --image=busybox -- date

# Create a deployment named my-dep that runs the nginx image with 3 replicas
ac create deployment my-dep --image=nginx --replicas=3

# Create a deployment named my-dep that runs the busybox image and expose port 5701
ac create deployment my-dep --image=busybox --port=5701

# Create a deployment named my-dep that runs multiple containers
ac create deployment my-dep --image=busybox:latest --image=ubuntu:latest --image=nginx
```

## ac create ingress

Create an ingress with the specified name

### Example usage

```
# Create a single ingress called 'simple' that directs requests to foo.com/bar to svc
# svc1:8080 with a TLS secret "my-cert"
ac create ingress simple --rule="foo.com/bar=svc1:8080,tls=my-cert"

# Create a catch all ingress of "/path" pointing to service svc:port and Ingress Class as "otheringress"
ac create ingress catch-all --class=otheringress --rule="/path=svc:port"

# Create an ingress with two annotations: ingress.annotation1 and ingress.annotations2
ac create ingress annotated --class=default --rule="foo.com/bar=svc:port" \
--annotation ingress.annotation1=foo \
--annotation ingress.annotation2=bla

# Create an ingress with the same host and multiple paths
ac create ingress multipath --class=default \
--rule="foo.com/=svc:port" \
--rule="foo.com/admin/=svcadmin:portadmin"

# Create an ingress with multiple hosts and the pathType as Prefix
ac create ingress ingress1 --class=default \
--rule="foo.com/path*=svc:8080" \
--rule="bar.com/admin*=svc2:http"

# Create an ingress with TLS enabled using the default ingress certificate and different path types
ac create ingress ingtls --class=default \
--rule="foo.com/=svc:https,tls" \
--rule="foo.com/path/subpath*=othersvc:8080"

# Create an ingress with TLS enabled using a specific secret and pathType as Prefix
ac create ingress ingsecret --class=default \
--rule="foo.com/*=svc:8080,tls=secret1"

# Create an ingress with a default backend
ac create ingress ingdefault --class=default \
--default-backend=defaultsvc:http \
--rule="foo.com/*=svc:8080,tls=secret1"
```

## ac create job

Create a job with the specified name

### Example usage

```
# Create a job
ac create job my-job --image=busybox

# Create a job with a command
ac create job my-job --image=busybox -- date

# Create a job from a cron job named "a-cronjob"
ac create job test-job --from=cronjob/a-cronjob
```

## ac create namespace

Create a namespace with the specified name

### Example usage

```
# Create a new namespace named my-namespace
ac create namespace my-namespace
```

## ac create poddisruptionbudget

Create a pod disruption budget with the specified name

### Example usage

```
# Create a pod disruption budget named my-pdb that will select all pods with the app=rails label
# and require at least one of them being available at any point in time
ac create poddisruptionbudget my-pdb --selector=app=rails --min-available=1

# Create a pod disruption budget named my-pdb that will select all pods with the app=nginx label
# and require at least half of the pods selected to be available at any point in time
ac create pdb my-pdb --selector=app=nginx --min-available=50%
```

## ac create priorityclass

Create a priority class with the specified name

### Example usage

```
# Create a priority class named high-priority
ac create priorityclass high-priority --value=1000 --description="high priority"

# Create a priority class named default-priority that is considered as the global default priority
ac create priorityclass default-priority --value=1000 --global-default=true --description="default priority"

# Create a priority class named high-priority that cannot preempt pods with lower priority
ac create priorityclass high-priority --value=1000 --description="high priority" --preemption-policy="Never"
```

## ac create quota

Create a quota with the specified name

### Example usage

```
# Create a new resource quota named my-quota
ac create quota my-quota --hard=cpu=1,memory=1G,pods=2,services=3,replicationcontrollers=2,resourcequotas=1,secrets=5,persistentvolumeclaims=10

# Create a new resource quota named best-effort
ac create quota best-effort --hard=pods=100 --scopes=BestEffort
```

## ac create role

Create a role with single rule

### Example usage

```
# Create a role named "pod-reader" that allows user to perform "get", "watch" and "list" on pods
ac create role pod-reader --verb=get --verb=list --verb=watch --resource=pods

# Create a role named "pod-reader" with ResourceName specified
ac create role pod-reader --verb=get --resource=pods --resource-name=readablepod --resource-name=anotherpod

# Create a role named "foo" with API Group specified
ac create role foo --verb=get,list,watch --resource=rs.apps

# Create a role named "foo" with SubResource specified
ac create role foo --verb=get,list,watch --resource=pods,pods/status
```

## ac create rolebinding

Create a role binding for a particular role or cluster role

### Example usage

```
# Create a role binding for user1, user2, and group1 using the admin cluster role
ac create rolebinding admin --clusterrole=admin --user=user1 --user=user2 --group=group1

# Create a role binding for service account monitoring:sa-dev using the admin role
ac create rolebinding admin-binding --role=admin --serviceaccount=monitoring:sa-dev
```

## ac create secret

Create a secret using a specified subcommand

## ac create secret docker-registry

Create a secret for use with a Docker registry

### Example usage

```
# If you do not already have a .dockercfg file, create a dockercfg secret directly
ac create secret docker-registry my-secret --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL

# Create a new secret named my-secret from ~/.docker/config.json
ac create secret docker-registry my-secret --from-file=path/to/.docker/config.json
```

## ac create secret generic

Create a secret from a local file, directory, or literal value

### Example usage

```
# Create a new secret named my-secret with keys for each file in folder bar
ac create secret generic my-secret --from-file=path/to/bar

# Create a new secret named my-secret with specified keys instead of names on disk
ac create secret generic my-secret --from-file=ssh-privatekey=path/to/id_rsa --from-file=ssh-publickey=path/to/id_rsa.pub

# Create a new secret named my-secret with key1=supersecret and key2=topsecret
ac create secret generic my-secret --from-literal=key1=supersecret --from-literal=key2=topsecret

# Create a new secret named my-secret using a combination of a file and a literal
ac create secret generic my-secret --from-file=ssh-privatekey=path/to/id_rsa --from-literal=passphrase=topsecret

# Create a new secret named my-secret from env files
ac create secret generic my-secret --from-env-file=path/to/foo.env --from-env-file=path/to/bar.env
```

## ac create secret tls

Create a TLS secret

### Example usage

```
# Create a new TLS secret named tls-secret with the given key pair
ac create secret tls tls-secret --cert=path/to/tls.crt --key=path/to/tls.key
```

## ac create service

Create a service using a specified subcommand

## ac create service clusterip

Create a ClusterIP service

### Example usage

```
# Create a new ClusterIP service named my-cs
ac create service clusterip my-cs --tcp=5678:8080

# Create a new ClusterIP service named my-cs (in headless mode)
ac create service clusterip my-cs --clusterip="None"
```

## ac create service externalname

Create an ExternalName service

### Example usage

```
# Create a new ExternalName service named my-ns
ac create service externalname my-ns --external-name bar.com
```

## ac create service loadbalancer

Create a LoadBalancer service

### Example usage

```
# Create a new LoadBalancer service named my-lbs
ac create service loadbalancer my-lbs --tcp=5678:8080
```

## ac create service nodeport

Create a NodePort service

### Example usage

```
# Create a new NodePort service named my-ns
ac create service nodeport my-ns --tcp=5678:8080
```

## ac create serviceaccount

Create a service account with the specified name

### Example usage

```
# Create a new service account named my-service-account
ac create serviceaccount my-service-account
```

## ac create token

Request a service account token

### Example usage

```
# Request a token to authenticate to the kube-apiserver as the service account "myapp" in the current namespace
ac create token myapp

# Request a token for a service account in a custom namespace
ac create token myapp --namespace myns

# Request a token with a custom expiration
ac create token myapp --duration 10m

# Request a token with a custom audience
ac create token myapp --audience https://example.com

# Request a token bound to an instance of a Secret object
ac create token myapp --bound-object-kind Secret --bound-object-name mysecret

# Request a token bound to an instance of a Secret object with a specific UID
ac create token myapp --bound-object-kind Secret --bound-object-name mysecret --bound-object-uid 0d4691ed-659b-4935-a832-355f77ee47cc
```

## ac delete

Delete resources by file names, stdin, resources and names, or by resources and label selector

### Example usage

```
# Delete a pod using the type and name specified in pod.json
ac delete -f ./pod.json

# Delete resources from a directory containing kustomization.yaml - e.g. dir/kustomization.yaml
ac delete -k dir

# Delete resources from all files that end with '.json'
ac delete -f '*.json'

# Delete a pod based on the type and name in the JSON passed into stdin
cat pod.json | ac delete -f -

# Delete pods and services with same names "baz" and "foo"
ac delete pod,service baz foo

# Delete pods and services with label name=myLabel
ac delete pods,services -l name=myLabel

# Delete a pod with minimal delay
ac delete pod foo --now

# Force delete a pod on a dead node
ac delete pod foo --force

# Delete all pods
ac delete pods --all

# Delete all pods only if the user confirms the deletion
ac delete pods --all --interactive
```

## ac describe

Show details of a specific resource or group of resources

### Example usage

```
# Describe a node
ac describe nodes kubernetes-node-emt8.c.myproject.internal

# Describe a pod
ac describe pods/nginx

# Describe a pod identified by type and name in "pod.json"
ac describe -f pod.json

# Describe all pods
ac describe pods

# Describe pods by label name=myLabel
ac describe pods -l name=myLabel

# Describe all pods managed by the 'frontend' replication controller
# (rc-created pods get the name of the rc as a prefix in the pod name)
ac describe pods frontend
```

## ac diff

Diff the live version against a would-be applied version

### Example usage

```
# Diff resources included in pod.json
ac diff -f pod.json

# Diff file read from stdin
cat service.yaml | ac diff -f -
```

## ac edit

Edit a resource on the server

### Example usage

```
# Edit the service named 'registry'
ac edit svc/registry

# Use an alternative editor
KUBE_EDITOR="nano" ac edit svc/registry

# Edit the job 'myjob' in JSON using the v1 API format
ac edit job.v1.batch/myjob -o json

# Edit the deployment 'mydeployment' in YAML and save the modified config in its annotation
ac edit deployment/mydeployment -o yaml --save-config

# Edit the 'status' subresource for the 'mydeployment' deployment
ac edit deployment mydeployment --subresource='status'
```

## ac events

List events

### Example usage

```
# List recent events in the default namespace
ac events

# List recent events in all namespaces
ac events --all-namespaces

# List recent events for the specified pod, then wait for more events and list them as they arrive
ac events --for pod/web-pod-13je7 --watch

# List recent events in YAML format
ac events -oyaml

# List recent only events of type 'Warning' or 'Normal'
ac events --types=Warning,Normal
```

## ac exec

Execute a command in a container

### Example usage

```
# Get output from running the 'date' command from pod mypod, using the first container by default
ac exec mypod -- date

# Get output from running the 'date' command in ruby-container from pod mypod
ac exec mypod -c ruby-container -- date

# Switch to raw terminal mode; sends stdin to 'bash' in ruby-container from pod mypod
# and sends stdout/stderr from 'bash' back to the client
ac exec mypod -c ruby-container -i -t -- bash -il

# List contents of /usr from the first container of pod mypod and sort by modification time
# If the command you want to execute in the pod has any flags in common (e.g. -i),
# you must use two dashes (--) to separate your command's flags/arguments
# Also note, do not surround your command and its flags/arguments with quotes
# unless that is how you would execute it normally (i.e., do ls -t /usr, not "ls -t /usr")
ac exec mypod -i -t -- ls -t /usr

# Get output from running 'date' command from the first pod of the deployment mydeployment, using the first container by default
ac exec deploy/mydeployment -- date

# Get output from running 'date' command from the first pod of the service myservice, using the first container by default
ac exec svc/myservice -- date
```

## ac explain

Get documentation for a resource

### Example usage

```
# Get the documentation of the resource and its fields
ac explain pods

# Get all the fields in the resource
ac explain pods --recursive

# Get the explanation for deployment in supported api versions
ac explain deployments --api-version=apps/v1

# Get the documentation of a specific field of a resource
ac explain pods.spec.containers

# Get the documentation of resources in different format
ac explain deployment --output=plaintext-openapiv2
```

## ac expose

Take a replication controller, service, deployment or pod and expose it as a new Kubernetes service

### Example usage

```
# Create a service for a replicated nginx, which serves on port 80 and connects to the containers on port 8000
ac expose rc nginx --port=80 --target-port=8000

# Create a service for a replication controller identified by type and name specified in "nginx-controller.yaml", which serves on port 80 and connects to the containers on port 8000
ac expose -f nginx-controller.yaml --port=80 --target-port=8000

# Create a service for a pod valid-pod, which serves on port 444 with the name "frontend"
ac expose pod valid-pod --port=444 --name=frontend

# Create a second service based on the above service, exposing the container port 8443 as port 443 with the name "nginx-https"
ac expose service nginx --port=443 --target-port=8443 --name=nginx-https

# Create a service for a replicated streaming application on port 4100 balancing UDP traffic and named 'video-stream'.
ac expose rc streamer --port=4100 --protocol=UDP --name=video-stream

# Create a service for a replicated nginx using replica set, which serves on port 80 and connects to the containers on port 8000
ac expose rs nginx --port=80 --target-port=8000

# Create a service for an nginx deployment, which serves on port 80 and connects to the containers on port 8000
ac expose deployment nginx --port=80 --target-port=8000
```

## ac get

Display one or many resources

### Example usage

```
# List all pods in ps output format
ac get pods

# List all pods in ps output format with more information (such as node name)
ac get pods -o wide

# List a single replication controller with specified NAME in ps output format
ac get replicationcontroller web

# List deployments in JSON output format, in the "v1" version of the "apps" API group
ac get deployments.v1.apps -o json

# List a single pod in JSON output format
ac get -o json pod web-pod-13je7

# List a pod identified by type and name specified in "pod.yaml" in JSON output format
ac get -f pod.yaml -o json

# List resources from a directory with kustomization.yaml - e.g. dir/kustomization.yaml
ac get -k dir/

# Return only the phase value of the specified pod
ac get -o template pod/web-pod-13je7 --template={{.status.phase}}

# List resource information in custom columns
ac get pod test-pod -o custom-columns=CONTAINER:.spec.containers[0].name,IMAGE:.spec.containers[0].image

# List all replication controllers and services together in ps output format
ac get rc,services

# List one or more resources by their type and names
ac get rc/web service/frontend pods/web-pod-13je7

# List the 'status' subresource for a single pod
ac get pod web-pod-13je7 --subresource status

# List all deployments in namespace 'backend'
ac get deployments.apps --namespace backend

# List all pods existing in all namespaces
ac get pods --all-namespaces
```

## ac kustomize

Build a kustomization target from a directory or URL

### Example usage

```
# Build the current working directory
ac kustomize

# Build some shared configuration directory
ac kustomize /home/config/production

# Build from github
ac kustomize https://github.com/kubernetes-sigs/kustomize.git/examples/helloWorld?ref=v1.0.6
```

## ac label

Update the labels on a resource

### Example usage

```
# Update pod 'foo' with the label 'unhealthy' and the value 'true'
ac label pods foo unhealthy=true

# Update pod 'foo' with the label 'status' and the value 'unhealthy', overwriting any existing value
ac label --overwrite pods foo status=unhealthy

# Update all pods in the namespace
ac label pods --all status=unhealthy

# Update a pod identified by the type and name in "pod.json"
ac label -f pod.json status=unhealthy

# Update pod 'foo' only if the resource is unchanged from version 1
ac label pods foo status=unhealthy --resource-version=1

# Update pod 'foo' by removing a label named 'bar' if it exists
# Does not require the --overwrite flag
ac label pods foo bar-
```

## ac login

Log in to an ACP platform

### Example usage

```
# Interactive login (prompts for missing parameters)
ac login https://example.com --name prod

# Login with all parameters via flags
ac login https://example.com --name prod --username=myuser --password=mypassword

# Login using environment variables (automation-friendly)
AC_LOGIN_PLATFORM_URL=https://example.com AC_LOGIN_SESSION=prod \
AC_LOGIN_USERNAME=myuser AC_LOGIN_PASSWORD=mypassword ac login

# Login with specific identity provider
ac login https://example.com --name prod --idp ldap-test

# Login and set specific cluster and namespace
ac login https://example.com --name prod --cluster=my-cluster --namespace=my-namespace

# Login with custom kubeconfig file
ac login https://example.com --name prod --kubeconfig=/path/to/kubeconfig
```

## ac logout

End current session with ACP platform

### Example usage

```
# Log out from current ACP platform session
ac logout

# Log out from specific session
ac logout --session prod

# Log out from all sessions
ac logout --all
```

## ac logs

Print the logs for a container in a pod

### Example usage

```
# Return snapshot logs from pod nginx with only one container
ac logs nginx

# Return snapshot logs from pod nginx, prefixing each line with the source pod and container name
ac logs nginx --prefix

# Return snapshot logs from pod nginx, limiting output to 500 bytes
ac logs nginx --limit-bytes=500

# Return snapshot logs from pod nginx, waiting up to 20 seconds for it to start running.
ac logs nginx --pod-running-timeout=20s

# Return snapshot logs from pod nginx with multi containers
ac logs nginx --all-containers=true

# Return snapshot logs from all pods in the deployment nginx
ac logs deployment/nginx --all-pods=true

# Return snapshot logs from all containers in pods defined by label app=nginx
ac logs -l app=nginx --all-containers=true

# Return snapshot logs from all pods defined by label app=nginx, limiting concurrent log requests to 10 pods
ac logs -l app=nginx --max-log-requests=10

# Return snapshot of previous terminated ruby container logs from pod web-1
ac logs -p -c ruby web-1

# Begin streaming the logs from pod nginx, continuing even if errors occur
ac logs nginx -f --ignore-errors=true

# Begin streaming the logs of the ruby container in pod web-1
ac logs -f -c ruby web-1

# Begin streaming the logs from all containers in pods defined by label app=nginx
ac logs -f -l app=nginx --all-containers=true

# Display only the most recent 20 lines of output in pod nginx
ac logs --tail=20 nginx

# Show all logs from pod nginx written in the last hour
ac logs --since=1h nginx

# Show all logs with timestamps from pod nginx starting from August 30, 2024, at 06:00:00 UTC
ac logs nginx --since-time=2024-08-30T06:00:00Z --timestamps=true

# Show logs from a kubelet with an expired serving certificate
ac logs --insecure-skip-tls-verify-backend nginx

# Return snapshot logs from first container of a job named hello
ac logs job/hello

# Return snapshot logs from container nginx-1 of a deployment named nginx
ac logs deployment/nginx -c nginx-1
```

## ac namespace

Show or switch current namespace context

### Example usage

```
# Show current namespace and context information
ac namespace

# Switch to a different namespace
ac namespace my-namespace

# Switch to default namespace
ac namespace default
```

## ac patch

Update fields of a resource

### Example usage

```
# Partially update a node using a strategic merge patch, specifying the patch as JSON
ac patch node k8s-node-1 -p '{"spec":{"unschedulable":true}}'

# Partially update a node using a strategic merge patch, specifying the patch as YAML
ac patch node k8s-node-1 -p $'spec:\n unschedulable: true'

# Partially update a node identified by the type and name specified in "node.json" using strategic merge patch
ac patch -f node.json -p '{"spec":{"unschedulable":true}}'

# Update a container's image; spec.containers[*].name is required because it's a merge key
ac patch pod valid-pod -p '{"spec":{"containers":[{"name":"kubernetes-serve-hostname","image":"new image"}]}}'

# Update a container's image using a JSON patch with positional arrays
ac patch pod valid-pod --type='json' -p='[{"op": "replace", "path": "/spec/containers/0/image", "value":"new image"}]'

# Update a deployment's replicas through the 'scale' subresource using a merge patch
ac patch deployment nginx-deployment --subresource='scale' --type='merge' -p '{"spec":{"replicas":2}}'
```

## ac plugin

Provides utilities for interacting with plugins

### Example usage

```
# List all available plugins
ac plugin list

# List only binary names of available plugins without paths
ac plugin list --name-only
```

## ac plugin list

List all visible plugin executables on a user's PATH

### Example usage

```
# List all available plugins
ac plugin list

# List only binary names of available plugins without paths
ac plugin list --name-only
```

## ac port-forward

Forward one or more local ports to a pod

### Example usage

```
# Listen on ports 5000 and 6000 locally, forwarding data to/from ports 5000 and 6000 in the pod
ac port-forward pod/mypod 5000 6000

# Listen on ports 5000 and 6000 locally, forwarding data to/from ports 5000 and 6000 in a pod selected by the deployment
ac port-forward deployment/mydeployment 5000 6000

# Listen on port 8443 locally, forwarding to the targetPort of the service's port named "https" in a pod selected by the service
ac port-forward service/myservice 8443:https

# Listen on port 8888 locally, forwarding to 5000 in the pod
ac port-forward pod/mypod 8888:5000

# Listen on port 8888 on all addresses, forwarding to 5000 in the pod
ac port-forward --address 0.0.0.0 pod/mypod 8888:5000

# Listen on port 8888 on localhost and selected IP, forwarding to 5000 in the pod
ac port-forward --address localhost,10.19.21.23 pod/mypod 8888:5000

# Listen on a random port locally, forwarding to 5000 in the pod
ac port-forward pod/mypod :5000
```

## ac process

Process a template into list of resources

### Example usage

```
# Convert the template.json file into a resource list and pass to create
ac process -f template.json | ac apply -f -

# Process a file locally instead of contacting the server
ac process -f template.json -o yaml

# Process template while passing a user-defined label
ac process -f template.json -l name=mytemplate

# Convert a stored template into a resource list
ac process foo

# Convert a stored template into a resource list by setting/overriding parameter values
ac process foo -p PARM1=VALUE1 -p PARM2=VALUE2

# Convert a template stored in different namespace into a resource list
ac process cpaas-system//foo

# Convert template.json into a resource list
cat template.json | ac process -f -
```

## ac proxy

Run a proxy to the Kubernetes API server

### Example usage

```
# To proxy all of the Kubernetes API and nothing else
ac proxy --api-prefix=/

# To proxy only part of the Kubernetes API and also some static files
# You can get pods info with 'curl localhost:8001/api/v1/pods'
ac proxy --www=/my/files --www-prefix=/static/ --api-prefix=/api/

# To proxy the entire Kubernetes API at a different root
# You can get pods info with 'curl localhost:8001/custom/api/v1/pods'
ac proxy --api-prefix=/custom/

# Run a proxy to the Kubernetes API server on port 8011, serving static content from ./local/www/
ac proxy --port=8011 --www=./local/www/

# Run a proxy to the Kubernetes API server on an arbitrary local port
# The chosen port for the server will be output to stdout
ac proxy --port=0

# Run a proxy to the Kubernetes API server, changing the API prefix to k8s-api
# This makes e.g. the pods API available at localhost:8001/k8s-api/v1/pods/
ac proxy --api-prefix=/k8s-api
```

## ac replace

Replace a resource by file name or stdin

### Example usage

```
# Replace a pod using the data in pod.json
ac replace -f ./pod.json

# Replace a pod based on the JSON passed into stdin
cat pod.json | ac replace -f -

# Update a single-container pod's image version (tag) to v4
ac get pod mypod -o yaml | sed 's/\(image: myimage\):.*$/\1:v4/' | ac replace -f -

# Force replace, delete and then re-create the resource
ac replace --force -f ./pod.json
```

## ac rollout

Manage the rollout of a resource

### Example usage

```
# Rollback to the previous deployment
ac rollout undo deployment/abc

# Check the rollout status of a daemonset
ac rollout status daemonset/foo

# Restart a deployment
ac rollout restart deployment/abc

# Restart deployments with the 'app=nginx' label
ac rollout restart deployment --selector=app=nginx
```

## ac rollout history

View rollout history

### Example usage

```
# View the rollout history of a deployment
ac rollout history deployment/abc

# View the details of daemonset revision 3
ac rollout history daemonset/abc --revision=3
```

## ac rollout pause

Mark the provided resource as paused

### Example usage

```
# Mark the nginx deployment as paused
# Any current state of the deployment will continue its function; new updates
# to the deployment will not have an effect as long as the deployment is paused
ac rollout pause deployment/nginx
```

## ac rollout restart

Restart a resource

### Example usage

```
# Restart all deployments in the test-namespace namespace
ac rollout restart deployment -n test-namespace

# Restart a deployment
ac rollout restart deployment/nginx

# Restart a daemon set
ac rollout restart daemonset/abc

# Restart deployments with the app=nginx label
ac rollout restart deployment --selector=app=nginx
```

## ac rollout resume

Resume a paused resource

### Example usage

```
# Resume an already paused deployment
ac rollout resume deployment/nginx
```

## ac rollout status

Show the status of the rollout

### Example usage

```
# Watch the rollout status of a deployment
ac rollout status deployment/nginx
```

## ac rollout undo

Undo a previous rollout

### Example usage

```
# Roll back to the previous deployment
ac rollout undo deployment/abc

# Roll back to daemonset revision 3
ac rollout undo daemonset/abc --to-revision=3

# Roll back to the previous deployment with dry-run
ac rollout undo --dry-run=server deployment/abc
```

## ac run

Run a particular image on the cluster

### Example usage

```
# Start a nginx pod
ac run nginx --image=nginx

# Start a hazelcast pod and let the container expose port 5701
ac run hazelcast --image=hazelcast/hazelcast --port=5701

# Start a hazelcast pod and set environment variables "DNS_DOMAIN=cluster" and "POD_NAMESPACE=default" in the container
ac run hazelcast --image=hazelcast/hazelcast --env="DNS_DOMAIN=cluster" --env="POD_NAMESPACE=default"

# Start a hazelcast pod and set labels "app=hazelcast" and "env=prod" in the container
ac run hazelcast --image=hazelcast/hazelcast --labels="app=hazelcast,env=prod"

# Dry run; print the corresponding API objects without creating them
ac run nginx --image=nginx --dry-run=client

# Start a nginx pod, but overload the spec with a partial set of values parsed from JSON
ac run nginx --image=nginx --overrides='{ "apiVersion": "v1", "spec": { ... } }'

# Start a busybox pod and keep it in the foreground, don't restart it if it exits
ac run -i -t busybox --image=busybox --restart=Never

# Start the nginx pod using the default command, but use custom arguments (arg1 .. argN) for that command
ac run nginx --image=nginx -- <arg1> <arg2> ... <argN>

# Start the nginx pod using a different command and custom arguments
ac run nginx --image=nginx --command -- <cmd> <arg1> ... <argN>
```

## ac scale

Set a new size for a deployment, replica set, or replication controller

### Example usage

```
# Scale a replica set named 'foo' to 3
ac scale --replicas=3 rs/foo

# Scale a resource identified by type and name specified in "foo.yaml" to 3
ac scale --replicas=3 -f foo.yaml

# If the deployment named mysql's current size is 2, scale mysql to 3
ac scale --current-replicas=2 --replicas=3 deployment/mysql

# Scale multiple replication controllers
ac scale --replicas=5 rc/example1 rc/example2 rc/example3

# Scale stateful set named 'web' to 3
ac scale --replicas=3 statefulset/web
```

## ac set

Set specific features on objects

## ac set env

Update environment variables on a pod template

### Example usage

```
# Update deployment 'registry' with a new environment variable
ac set env deployment/registry STORAGE_DIR=/local

# List the environment variables defined on a deployments 'sample-build'
ac set env deployment/sample-build --list

# List the environment variables defined on all pods
ac set env pods --all --list

# Output modified deployment in YAML, and does not alter the object on the server
ac set env deployment/sample-build STORAGE_DIR=/data -o yaml

# Update all containers in all replication controllers in the project to have ENV=prod
ac set env rc --all ENV=prod

# Import environment from a secret
ac set env --from=secret/mysecret deployment/myapp

# Import environment from a config map with a prefix
ac set env --from=configmap/myconfigmap --prefix=MYSQL_ deployment/myapp

# Import specific keys from a config map
ac set env --keys=my-example-key --from=configmap/myconfigmap deployment/myapp

# Remove the environment variable ENV from container 'c1' in all deployment configs
ac set env deployments --all --containers="c1" ENV-

# Remove the environment variable ENV from a deployment definition on disk and
# update the deployment config on the server
ac set env -f deploy.json ENV-

# Set some of the local shell environment into a deployment config on the server
env | grep RAILS_ | ac set env -e - deployment/registry
```

## ac set image

Update the image of a pod template

### Example usage

```
# Set a deployment's nginx container image to 'nginx:1.9.1', and its busybox container image to 'busybox'
ac set image deployment/nginx busybox=busybox nginx=nginx:1.9.1

# Update all deployments' and rc's nginx container's image to 'nginx:1.9.1'
ac set image deployments,rc nginx=nginx:1.9.1 --all

# Update image of all containers of daemonset abc to 'nginx:1.9.1'
ac set image daemonset abc *=nginx:1.9.1

# Print result (in yaml format) of updating nginx container image from local file, without hitting the server
ac set image -f path/to/file.yaml nginx=nginx:1.9.1 --local -o yaml
```

## ac set resources

Update resource requests/limits on objects with pod templates

### Example usage

```
# Set a deployments nginx container cpu limits to "200m" and memory to "512Mi"
ac set resources deployment nginx -c=nginx --limits=cpu=200m,memory=512Mi

# Set the resource request and limits for all containers in nginx
ac set resources deployment nginx --limits=cpu=200m,memory=512Mi --requests=cpu=100m,memory=256Mi

# Remove the resource requests for resources on containers in nginx
ac set resources deployment nginx --limits=cpu=0,memory=0 --requests=cpu=0,memory=0

# Print the result (in yaml format) of updating nginx container limits from a local, without hitting the server
ac set resources -f path/to/file.yaml --limits=cpu=200m,memory=512Mi --local -o yaml
```

## ac set selector

Set the selector on a resource

### Example usage

```
# Set the labels and selector before creating a deployment/service pair
ac create service clusterip my-svc --clusterip="None" -o yaml --dry-run=client | ac set selector --local -f - 'environment=qa' -o yaml | ac create -f -
ac create deployment my-dep -o yaml --dry-run=client | ac label --local -f - environment=qa -o yaml | ac create -f -
```

## ac set serviceaccount

Update the service account of a resource

### Example usage

```
# Set deployment nginx-deployment's service account to serviceaccount1
ac set serviceaccount deployment nginx-deployment serviceaccount1

# Print the result (in YAML format) of updated nginx deployment with the service account from local file, without hitting the API server
ac set sa -f nginx-deployment.yaml serviceaccount1 --local --dry-run=client -o yaml
```

## ac set subject

Update the user, group, or service account in a role binding or cluster role binding

### Example usage

```
# Update a cluster role binding for serviceaccount1
ac set subject clusterrolebinding admin --serviceaccount=namespace:serviceaccount1

# Update a role binding for user1, user2, and group1
ac set subject rolebinding admin --user=user1 --user=user2 --group=group1

# Print the result (in YAML format) of updating rolebinding subjects from a local, without hitting the server
ac create rolebinding admin --role=admin --user=admin -o yaml --dry-run=client | ac set subject --local -f - --user=foo -o yaml
```

## ac version

Print the client and server version information

### Example usage

```
# Print client and server version information
ac version

# Print client version only
ac version --client

# Print version in JSON format
ac version -o json
```

## ac wait

Experimental: Wait for a specific condition on one or many resources

### Example usage

```
# Wait for the pod "busybox1" to contain the status condition of type "Ready"
ac wait --for=condition=Ready pod/busybox1

# The default value of status condition is true; you can wait for other targets after an equal delimiter (compared after Unicode simple case folding, which is a more general form of case-insensitivity)
ac wait --for=condition=Ready=false pod/busybox1

# Wait for the pod "busybox1" to contain the status phase to be "Running"
ac wait --for=jsonpath='{.status.phase}'=Running pod/busybox1

# Wait for pod "busybox1" to be Ready
ac wait --for='jsonpath={.status.conditions[?(@.type=="Ready")].status}=True' pod/busybox1

# Wait for the service "loadbalancer" to have ingress
ac wait --for=jsonpath='{.status.loadBalancer.ingress}' service/loadbalancer

# Wait for the secret "busybox1" to be created, with a timeout of 30s
ac create secret generic busybox1
ac wait --for=create secret/busybox1 --timeout=30s

# Wait for the pod "busybox1" to be deleted, with a timeout of 60s, after having issued the "delete" command
ac delete pod/busybox1
ac wait --for=delete pod/busybox1 --timeout=60s
```