---
weight: 30
sourceSHA: a98a8050332e7fec6675d1d403189a7d11760e4165f18660bb20facb13477c10
---

# Measurement Details

The platform can retain usage detail data for nearly 18 months and supports querying visual report details for statistical items within a custom time range (the last 31 days).

You can filter based on statistical items (container group usage, container group quota), project name, project associated cluster, and namespace under the cluster. Meanwhile, clicking **Export Results** allows you to export the filtered statistical data as a CSV formatted report.

## Prerequisites

If you need to export the statistical report, you must configure storage for operational statistics when deploying the platform.

## Steps

1. In the left navigation bar, click **Operational Statistics** > **Measurement Details**.

   **Or**: On the **Statistical Report** page, when the **Statistical Item** is `Container Group Quota` or `Container Group Usage`, click the **Details** button on the right side of a single query result record to enter the measurement details page to view the detail data.

2. Refer to the instructions in the figure below, select the statistical time range, statistical items, project, cluster, and namespace, then click the **Search** button to view the corresponding usage detail data.

   **Note**:

   - The platform retains data only within the last 18 months, and the maximum supported time range for a single query is 31 days.

   - Container Group Usage: This is calculated based on the actual usage of Pods, summing the average of the actual usage taken every 5 minutes.

   - Container Group Quota: This is based on the request values (requests) of Pods.

   - Supports sorting by **Container Group Name** (initial letter), **Total CPU Usage** (size), and **Total Memory Usage** (size).
