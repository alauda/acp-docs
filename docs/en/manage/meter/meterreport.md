---
weight: 20
sourceSHA: dff0cddc02a9548bfd4db95c84177eebf3c2ab465da7be86064f9e2e146d1544
---

# Statistical Report

Operational statistical data can be retained on the platform for a maximum of 540 days, after which the platform will automatically delete any data beyond this retention period. It supports viewing visual report data for statistical items within a custom time range (maximum time span of 6 months). Filtering is available based on statistical granularity (project, namespace) and project (all, custom projects).

Statistical items include: container group usage, container group quotas, project quotas, and namespace quotas. Additionally, clicking **Export Results** allows users to export the filtered statistical data as a CSV format report.

**Note**: Detailed data can only be viewed when the **Statistical Item** is set to `Container Group Quota` or `Container Group Usage`.

## Operating Steps

1. In the left navigation bar, click on **Operational Statistics** > **Statistical Report**.

2. Refer to the instructions in the image below to select the statistical time range, statistical items, and statistical granularity. After configuring the project filtering criteria, click the **Search** button to view the corresponding statistical report data.

   **Note**:

   - The platform retains data only within 540 days, and the maximum time span for a single query is 6 months.

   - Container Group Usage: Calculated based on the actual usage of Pods, with the average value taken every 5 minutes to derive the total.

   - Container Group Quota: Calculated based on the request value (request) size of the Pods.

   - Namespace Quota: Calculated based on the CPU and memory quotas of the namespace, with statistics conducted once daily; if quotas change, the statistics will reflect the new quotas starting the following day.

   - Project Quota: Calculated based on the CPU and memory quotas of the project, with statistics generated once daily; if quotas change, the statistics will reflect the new quotas starting the following day.

   - Detailed views are supported when the **Statistical Item** is set to `Container Group Quota` or `Container Group Usage`.

   - Sorting is supported based on **Namespace Name** (first letter), **Belonging Project** (first letter of the name), **Total CPU Usage** (size), and **Total Memory Usage** (size).
