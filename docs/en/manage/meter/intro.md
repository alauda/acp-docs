---
weight: 2
sourceSHA: d5041d0e9bf6f1c1e4703dfde1307a4ddb43d425da821e0cb9d69219cbe78af8
---

# Introduction

The feature provides **comprehensive resource measurement and operation statistics capabilities** for the container platform, supporting precise measurement and statistical analysis of resource usage across all resources within the platform. By real-time collection and aggregation of resource usage data, administrators can gain an overall understanding of resource allocation, utilization, and quota situations, helping to optimize resource efficiency and enhance platform operational effectiveness. The main functionalities include:

- **Resource Measurement**: Supports resource measurement based on dimensions such as CPU/MEM Usage, Request, Quota, etc.
- **Multi-dimensional Statistics**: Provides multi-dimensional resource usage statistics for clusters, namespaces, workloads, etc.

## Advantages

1. Precise Measurement

- **Real-time Data Collection**: Utilizes Prometheus for real-time collection of resource usage data, ensuring measurement accuracy.
- **Multi-dimensional Measurement**: Supports resource measurement based on multiple dimensions like CPU/MEM Usage, Request, Quota, meeting the needs of various scenarios.

2. Comprehensive Statistics

- **Cluster-level Statistics**: Displays resource usage across the entire cluster, helping administrators understand global resource distribution.
- **Namespace-level Statistics**: Statistics of resource usage per namespace, facilitating cost allocation and resource management by teams.

3. Visual Reports

- **Detailed Reports**: Provides detailed resource usage reports, supporting export in CSV/Excel formats for further analysis.

## Application Scenarios

**Resource Optimization**: When the platform's resource utilization is low, the measurement and statistical functions can identify low-utilization resources for optimization and reallocation.  
**Cost Allocation**: When the finance department needs to allocate resource costs by team or project, the namespace-level statistical function can generate detailed resource usage reports.
