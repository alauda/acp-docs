---
weight: 10
sourceSHA: fd63b5574e022638e4906564b50b6523359dd3f7b85c9ddecef7cd64f205030d
---

# Operational Overview

The operational overview of the platform presents a visualization report that shows the total usage of CPU/memory within a specified statistical time range, as well as the usage statistics for the top 5 projects or namespaces by usage.

It supports viewing project quotas for the current month (by default), past month, and the last 3 months (this month and the two preceding full months), while summarizing the usage of container groups, container group quotas, namespace quotas, and total CPU/memory usage by project or namespace.

## Operation Steps

1. In the left navigation bar, click **Operational Statistics** > **Operational Overview**.

   Refer to the illustration instructions to switch the statistical time range, statistical items, and statistical granularity to view the corresponding operational overview data.

   **Note**: Container group usage is calculated based on the actual usage of Pods, while container group quotas are based on the requested (request) values of Pods.
