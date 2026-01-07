---
weight: 20
---

# FunctionResource Index

This index is based on ACP v4.2.  
The required items marked in the table are the baseline permissions needed for normal use of the product UI.

Note: The “Namespace Resource Management” module defines a `*` scope over K8s resources. Do not configure this module in custom roles to avoid unintended permissions.

## View

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Platformview | views-platformview |  |  |
| Projectview | views-projectview |  |  |
| Acp-userview | views-acp-userview | Yes | View |
| Devops-userview | views-devops-userview |  |  |
| Asm-userview | views-asm-userview |  |  |
| Featuregates | platform-manage-featuregates |  |  |
| Portal | platform-manage-portal | Yes | View |
| Data Services User View | views-dataservices-userview |  |  |
| Container Security View | views-containersecurityview |  |  |
| CloudEdge View | views-cec-userview |  |  |

## Administrator

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Clusters | infrastructure-clusters | Yes | View |
| Clusterviews | infrastructure-clusterviews |  |  |
| Nodesmanage | infrastructure-nodesmanage |  |  |
| Domains | infrastructure-domains |  |  |
| Subnet | acp-subnet |  |  |
| Networkpolicies | acp-networkpolicies |  |  |
| Networkdiagnose | acp-networkdiagnose |  |  |
| Storageclasses | infrastructure-storageclasses |  |  |
| Persistentvolumes | infrastructure-persistentvolumes |  |  |
| Virtualmachineimagetemplates | acp-virtualmachineimagetemplates |  |  |
| Logs | aiops-logs |  |  |
| Archivelogs | aiops-archivelogs |  |  |
| Events | aiops-events |  |  |
| Alerts | aiops-alerts |  |  |
| Alerttemplate | aiops-alerttemplate |  |  |
| Alerthistories | aiops-alerthistories |  |  |
| Notifications | aiops-notifications |  |  |
| Notificationsmanage | aiops-notificationsmanage |  |  |
| Inspections | aiops-inspections |  |  |
| Devopstools | devops-devopstools |  |  |
| Toolbindings | devops-toolbindings |  |  |
| Toolresource | devops-toolresource |  |  |
| Clusterpipelinetasktemplates | devops-clusterpipelinetasktemplates |  |  |
| Clusterpipelinetemplates | devops-clusterpipelinetemplates |  |  |
| Clusterpipelinetemplatesyncs | devops-clusterpipelinetemplatesyncs |  |  |
| Secret | devops-secret |  |  |
| Integrationclasses | devops-integrationclasses |  |  |
| Clusterintegrations | devops-clusterintegrations |  |  |
| Nodegroups | acp-nodegroups |  |  |
| Productlist | platform-manage-productlist | Yes | View |
| ProductManagement | product-management | Yes | View |
| Certificates | platform-manage-certificates |  |  |
| Usersmanage | platform-manage-usersmanage |  |  |
| Userbindings | platform-manage-userbindings |  |  |
| Rolesmanage | platform-manage-rolesmanage |  |  |
| Idpmanage | platform-manage-idpmanage |  |  |
| Userpolicies | platform-manage-userpolicies |  |  |
| Meters | platform-manage-meters |  |  |
| Audits | aiops-audits |  |  |
| Platformconfig | platform-manage-systemconfig |  |  |
| Regions | infrastructure-regions |  |  |
| Accesstokeninfoes | platform-manage-accesstokeninfoes | Yes | Create/Delete |
| Commonconfigs | platform-manage-commonconfigs |  |  |
| Customresourcedefinitions | infrastructure-crd |  |  |
| Provider-networks | acp-provider-networks |  |  |
| VLAN | acp-vlan |  |  |
| Localstorage | acp-localstorage |  |  |
| Builtinstorage | acp-builtinstorage |  |  |
| Clustermodules | infrastructure-clustermodules |  |  |
| Moduleinfo | infrastructure-moduleinfo | Yes | View |
| Moduleplugin | infrastructure-plugin |  |  |
| Interconnectionsubnets | acp-interconnectionsubnets |  |  |
| Backupandrestore | infrastructure-backupandrestore |  |  |
| Backupstoragelocationrepo | infrastructure-backupstoragelocationrepo |  |  |
| Monitoring Metrics | aiops-monitoring-metrics |  |  |
| Monitoring Dashboard | aiops-monitoring-dashboard |  |  |
| Compliance | platform-manage-compliance |  |  |
| Usergroupsmanage | platform-manage-usergroupsmanage |  |  |
| Loadbalancer | acp-loadbalancer |  |  |
| Iaas-machinepool | infrastructure-iass-machinepool |  |  |
| Costs | aiops-costs |  |  |
| Operatorviews | infrastructure-operatorviews |  |  |
| Modulepluginviews | infrastructure-modulepluginviews |  |  |
| Namespace roles manage | platform-manage-namespace-rolesmanage |  |  |
| Artifactcleanupruns | devops-katanomi-artifactcleanupruns |  |  |
| Artifactcleanups | devops-artifactcleanups |  |  |
| Artifactpromotionapprovals | devops-artifactpromotionapprovals |  |  |
| Clusternetworkpolicies | acp-clusternetworkpolicies |  |  |
| Promotionpolicy | devops-clusterpromotionpolicies |  |  |
| Toolsinstances | devops-toolsinstances |  |  |

## Projects

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Project | platform-manage-projectmanage | Yes | View |
| Namespaces | acp-namespaces | Yes | View |
| Resourcequotas | acp-resourcequotas |  |  |
| Limitranges | acp-limitranges |  |  |
| Pipelinetasktemplates | devops-pipelinetasktemplates |  |  |
| Pipelinetemplates | devops-pipelinetemplates |  |  |
| Pipelinetemplatesyncs | devops-pipelinetemplatesyncs |  |  |
| Projectsettings | devops-projectsettings |  |  |
| Integrations | devops-integrations |  |  |
| Namespace-import | acp-namespace-import |  |  |
| Projectbinding | platform-manage-projectbinding | Yes | View |
| Project-users | devops-virtualusers |  |  |
| Projectmembers | project-manage-projectmembers |  |  |

## Container Platform

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Application | acp-app |  |  |
| Loadbalance-use | acp-loadbalance-use |  |  |
| Rules | acp-rules |  |  |
| Openshiftroutes | acp-openshiftroutes |  |  |
| Configmap | acp-configmap |  |  |
| Namespaceoverviews | acp-namespaceoverviews |  |  |
| Alertsquery | acp-alertsquery |  |  |
| K8sresource | acp-k8sresource |  |  |
| Podsexec | acp-podsexec |  |  |
| Podslog | acp-podslog |  |  |
| Catalog | acp-catalog |  |  |
| Autoscalers | acp-autoscalers |  |  |
| Loadbalance | infrastructure-loadbalance |  |  |
| Virtualmachines | acp-virtualmachine |  |  |
| Namespaceaudits | acp-namespaceaudits |  |  |
| Serviceaccounts | acp-serviceaccounts |  |  |
| Operator Backed View | acp-operator-backed-view |  |  |
| OAM Application | acp-oamapp |  |  |
| Volumesnapshot | acp-volumesnapshot |  |  |
| Namespace resource manage | acp-namespace-resource-manage |  |  |
| Cosi | acp-cosi |  |  |
| User configmap | acp-user-configmap |  |  |
| User secret | acp-user-secret |  |  |
| Batchaction | acp-batchaction |  |  |
| Imagewhitelist | acp-imagewhitelist |  |  |
| Metallb | acp-metallb |  |  |
| VerticalPodAutoscaler | acp-vpa |  |  |
| Namespace Resource Ratio | acp-namespace-resource-ratio |  |  |
| Cloudedge | acp-cloudedge |  |  |
| Application Package Management | acp-app-package-management |  |  |
| GitOps Application | acp-gitops-app |  |  |
| Gatewayapi | acp-gatewayapi |  |  |
| Gatewayapigatewayclass | acp-gatewayapigatewayclass |  |  |
| IngressClass | acp-ingressclass |  |  |
| Virtualmachinesimageinstance | acp-vmimageinstance |  |  |
| Image | acp-image |  |  |
| Console YAML Sample | acp-consoleyamlsample |  |  |
| Gatewayapi-routes | acp-gatewayapi-routes |  |  |
| Operator Backed Manage | acp-operator-backed-manage |  |  |

## DevOps

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Pipelineconfigs | devops-pipelineconfigs |  |  |
| Pipelines | devops-pipelines |  |  |
| Builds | devops-builds |  |  |
| Namespace builds | devops-builds-ns |  |  |
| Buildruns | devops-buildruns |  |  |
| Namespace buildruns | devops-buildruns-ns |  |  |
| Deliveries clusterstages | devops-clusterstages |  |  |
| Tekton | devops-tekton |  |  |
| Deliveries | devops-deliveries |  |  |
| Deliveryruns | devops-deliveryruns |  |  |
| Stages | devops-stages |  |  |
| Stageruns | devops-stageruns |  |  |
| Allocated resources | devops-projects |  |  |
| Code repository | devops-gitrepositories |  |  |
| Code branch | devops-gitbranches |  |  |
| Artifacts | devops-virtualartifacts |  |  |
| Code commit | devops-gitcommits |  |  |
| Code qualities | devops-codequalities |  |  |
| Repositories | devops-virtualrepositories |  |  |
| Testplans | devops-testplans |  |  |
| Testmodules | devops-testmodules |  |  |
| Issues | devops-virtualissues |  |  |
| Testcases | devops-testcases |  |  |
| Issuebranches | devops-virtualissuebranches |  |  |
| Testcaseexecutions | devops-testcaseexecutions |  |  |
| Versionschemes | devops-versionschemes |  |  |
| Versionstreams | devops-versionstreams |  |  |
| Versionrequests | devops-versionrequests |  |  |
| Clustergitsources | devops-clustergitsources |  |  |
| Artifactfiles | devops-virtualartifactsfiles |  |  |
| Gitsources | devops-gitsources |  |  |
| Clustertemplates | devops-clustertemplates |  |  |
| Storageplugins | devops-storageplugins |  |  |
| Clusterpolicies | devops-clusterpolicies |  |  |
| Clusterrule | devops-clusterrule |  |  |
| Policies | devops-policies |  |  |
| Policyruns | devops-policyruns |  |  |
| Templaterenders | devops-templaterenders |  |  |
| Katanomi | devops-katanomi |  |  |
| Tag | devops-gitrepositorytags |  |  |
| TektonPipeline | devops-tektonpipeline |  |  |
| Artifactpromotionruns | devops-artifactpromotionruns |  |  |
| Artifactpromotions | devops-artifactpromotions |  |  |
| Knative | devops-knative |  |  |
| Variables | devops-variables |  |  |

## DevOps v4

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Tekton Triggers | devopsv4-tekton-triggers |  |  |
| Tekton Triggers EventListeners Administration | devopsv4-tekton-triggers-admin |  |  |
| Namespaced connectors | devopsv4-connectors-namespaced |  |  |
| Tekton Cluster Administration | devopsv4-tekton-cluster-admin |  |  |
| Tekton Operator | devopsv4-tekton-deployment-admin |  |  |
| Connectorclasses | devopsv4-connectorclasses |  |  |
| Cluster connectors | devopsv4-connectors-cluster |  |  |
| Project connectors | devopsv4-connectors-project |  |  |
| Resourceinterfaces | devopsv4-resourceinterfaces |  |  |
| Tekton Pipelines | devopsv4-tekton-pipelines |  |  |

## Service Mesh

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| Gateways | asm-gateways |  |  |
| Virtualservices | asm-virtualservices |  |  |
| Asmloadbalancers | asm-asmloadbalancers |  |  |
| Peerauthentications | asm-policies |  |  |
| Errorchecks | asm-errorchecks |  |  |
| Clusterconfig | asm-clusterconfig |  |  |
| Connectionpools | asm-connectionpools |  |  |
| Microservices | asm-microservices |  |  |
| Whitelists | asm-whitelists |  |  |
| Outlierdetections | asm-outlierdetections |  |  |
| Servicemeshs | asm-servicemeshs |  |  |
| Casemonitors | asm-casemonitors |  |  |
| Asmk8sresource | asm-asmk8sresource |  |  |
| Authorizationpolicy | asm-authorizationpolicy |  |  |
| Istiosecurity | asm-istiosecurity |  |  |
| Istioauthentication | asm-istioauthentication |  |  |
| Istiorbac | asm-istiorbac |  |  |
| Istioconfig | asm-istioconfig |  |  |
| Istionetworking | asm-istionetworking |  |  |
| Canarydeliveries | asm-canarydeliveries |  |  |
| Canarytemplates | asm-canarytemplates |  |  |
| Canaryevents | asm-canaryevents |  |  |
| Serviceentries | asm-serviceentries |  |  |
| Domains | asm-domains |  |  |
| Apiattributes | asm-apiattributes |  |  |
| Routerules | asm-routerules |  |  |
| Appconfigs | asm-appconfigs |  |  |
| Gatewaygroups | asm-gatewaygroups |  |  |
| Envoyfilters | asm-envoyfilters |  |  |
| Envoyfiltertemplates | asm-envoyfiltertemplates |  |  |
| Envoyfiltertemplatesyncs | asm-envoyfiltertemplatesyncs |  |  |
| Envoyfilterbindings | asm-envoyfilterbindings |  |  |
| Servicemeshgroups | asm-servicemeshgroups |  |  |
| Microservicepolicies | asm-microservicepolicies |  |  |
| Sidecarbypasses | asm-sidecarbypasses |  |  |
| Wasmmoduletemplates | asm-wasmmoduletemplates |  |  |
| Wasmmoduleinstalls | asm-wasmmoduleinstalls |  |  |
| Wasmmoduledeployments | asm-wasmmoduledeployments |  |  |
| Istioproxyupdatetasks | asm-istioproxyupdatetasks |  |  |
| Istiocanaryupdates | asm-istiocanaryupdates |  |  |
| Jwtpolicies | asm-jwtpolicies |  |  |
| Ingressgateways | asm-ingressgateways |  |  |
| Gatewaydeploys | asm-gatewaydeploys |  |  |
| Isolatepods | asm-isolatepods |  |  |
| Globalratelimiters | asm-globalratelimiters |  |  |
| Gatewayprojectbindings | asm-gatewayprojectbindings |  |  |
| Serviceregistries | asm-serviceregistries |  |  |
| Opentelemetrycollectors | asm-opentelemetrycollectors |  |  |
| Instrumentations | asm-instrumentations |  |  |
| Manualgrayevents | asm-manualgrayevents |  |  |
| Manualgrayreleases | asm-manualgrayreleases |  |  |

## Data Service

| Function Name | Functionresource Name | Required | Operations |
| --- | --- | --- | --- |
| MySQL (PXC) Instance | acp-middleware-mysql |  |  |
| MySQL (PXC) User | acp-middleware-mysqluser |  |  |
| MySQL (PXC) Backup/Restore | acp-middleware-mysqlrestore |  |  |
| Redis | acp-middleware-redis |  |  |
| Redis Backup and Restore | acp-middleware-redisbackup |  |  |
| Redis Failover | acp-middleware-redisfailover |  |  |
| Kafka Cluster | acp-middleware-kafka |  |  |
| Kafka Tools | acp-middleware-kafka-tools |  |  |
| Kafka Topic | acp-middleware-kafkatopic |  |  |
| Kafka User | acp-middleware-kafkauser |  |  |
| MongoDB ReplicaSets | acp-middleware-mongo |  |  |
| MongoDB Backup/Restore | acp-middleware-mongo-backup-restore |  |  |
| RabbitMQ Cluster Manage | acp-middleware-rabbitmq |  |  |
| PostgreSQL Cluster Manage | acp-middleware-postgresql |  |  |
| MySQL (MGR) Cluster Manage | acp-middleware-mysql-mgr |  |  |
| MySQL (MGR) Backup/Restore | acp-middleware-mysqlmgr-backup-restore |  |  |
| MySQL para template | acp-middleware-mysql-para-template |  |  |
| BackupStorage Instance | acp-middleware-backupstorage |  |  |
| Backup Management | acp-middleware-backupstat |  |  |
| Alert Center | acp-middleware-alertcenter |  |  |
| Inspection | acp-middleware-inspection |  |  |
| Inspection Job | acp-middleware-inspectionjob |  |  |
| Parameter Definition | acp-middleware-paramdefinition |  |  |
| System Parameter Templates | acp-middleware-paramtemplate-system |  |  |
| Custom Parameter Template Templates | acp-middleware-paramtemplate-project |  |  |
| Version Control | acp-middleware-imageversions |  |  |
| Redis User | acp-middleware-redisuser |  |  |
| RocketMQ Cluster Manage | acp-middleware-rocketmq |  |  |
