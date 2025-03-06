---
weight: 2
sourceSHA: 6b651705766662ec2c36375d3ae46baafcc422de9d1442c4b2a8019df9336cf0
---

# Introduction

This feature is deeply integrated with Kubecost technology to provide **enterprise-level FinOps cost management capabilities** for container platforms, supporting unified cost visualization and resource insights across multiple Kubernetes clusters. By aggregating cost data from cloud-native environments, it achieves:

- **Multi-cluster cost aggregation analysis**: presents the resource consumption proportions of different clusters/cloud providers from a global perspective.
- **Team-level cost breakdown**: automatically consolidates business team costs based on Namespace/Label.
- **Resource-cost dual-dimensional correlation**: simultaneously displays the relationship between resource utilization and cost expenditures.

## Advantages

**Panoramic cost visualization**

- Supports **cross-cluster cost comparisons** in hybrid cloud/multi-cloud environments.
- Provides hourly precision cost fluctuation trend analysis.

**Precise cost allocation**

- Supports custom cost allocation rules (CPU/Memory/GPU weighted calculations).
- Automatically generates team cost bills, supporting multiple export formats including CSV/Excel.

**Intelligent optimization loop**

- Identifies low-utilization Pods (CPU < 20% sustained for 24 hours) and recommends specification adjustments.
- Discovers "zombie resources" (PV/Service, etc. not associated with workloads) and automatically tags them.

## Application Scenarios

**Hybrid cloud cost governance**
When enterprises use both IDC clusters and public cloud clusters, compare the unit computing costs of different environments to provide cost basis for workload scheduling.

**Project cost accounting**
Finance departments need to break down container platform expenses by product line, automatically generating monthly cloud cost reports for each product line through the labeling system.

**Anomaly consumption localization**
When a certain cluster experiences a sudden 200% cost spike, use the **time axis drilling** feature to quickly locate the abnormal Deployment and its associated log service calls surge.

**Resource optimization practice**
After reviewing the resource utilization report for their department, the development team proactively adjusts the CPU Request of test environment Pods from 4 cores to 1 core.

## Usage Limitations

- This feature relies on the corresponding cluster having the Monitoring with Prometheus plugin deployed, please ensure it is deployed in advance.
- This feature cannot be used in conjunction with the metering and billing functionalities provided by the product.
