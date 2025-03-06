---
weight: 6
sourceSHA: 6a28cee6715379597f05a55bdaa85010a04a51bfea812d7001ffc9c3a9a7f101
---

# Exporting Platform Cost Data

Export multi-dimensional and multi-granular cost data according to the specified time range.

## <span id="platexport">Exporting Platform Cost Data</span>

### Operating Steps

1. Click on **Operational Statistics** > **Cost Management** in the left navigation bar.

2. Click on **Export Data** in the upper left corner.

3. Configure the relevant parameters according to the following instructions.

   | Parameter    | Description                                                                                                                                                                                                                                                       |
   | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | Raw Data     | Export cost data for all namespaces of the platform according to the selected time range. This data has not undergone any statistical aggregation of dimensions.                                                                                                                                      |
   | Summary Data | Export cost data according to the selected statistical dimensions, data granularity, and time range.                                                                                                                                                             |
   | Platform Cost | Export summary cost data for multiple clusters or projects. <br><br><b>Note</b>: The optional data granularity for exporting platform costs is **Cluster** and **Project**.                                                                                               |
   | Cluster Cost  | Export cost data for one or more specified clusters. If you choose to export multiple clusters, a separate cost report will be generated for each cluster’s cost data. <br><br><b>Note</b>: <ul><li>Only cost data for clusters that have successfully deployed the Kubecost plugin can be selected and exported.</li><li>The optional **data granularity** for exporting platform costs is **Namespace** and **Project**.</li></ul>        |
   | Project Cost   | Export cost data for one or more specified projects. If you choose to export multiple projects, a separate cost report will be generated for each project’s cost data. <br><br><b>Note</b>: Only cost data with **Namespace** granularity can be exported.                                                                 |
   | Time Range     | Supports exporting cost data for a maximum of the past 7 days. <ul><li>**Past 1 day**: Export cost data **per hour** according to the selected dimensions.</li><li>**Past 7 days**: Export cost data **per day** according to the selected dimensions.</li><li>**Custom**: If the number of days chosen for export is less than or equal to 2 days, cost data will be exported **per hour** according to the selected dimensions; if the number of days chosen for export is greater than 2 days but less than or equal to 7 days, cost data will be exported **per day** according to the selected dimensions, and the export time points can be customized down to the second.</li></ul> |

4. Click on **Export**.

## Exporting Cluster or Project Cost Data

There are two ways to export cluster or project cost data:

- Export the cost data of clusters or projects from the platform cost management page. Please refer to [Exporting Platform Cost Data](#platexport) for details.

- Export the cost data of clusters or projects from the cluster or project cost management page. The operating steps are as follows.

  1. Click on **Operational Statistics** > **Cost Management** in the left navigation bar.

  2. Click on the **Cluster Cost Distribution** or **Project Cost Distribution** tab above the **Cost Distribution Chart**.

  3. Click on the corresponding ***Cluster or Project Name*** in the **Cost Distribution List**.

  4. Click on **Export Data** in the upper left corner.

  5. Configure the parameters as needed, and then click on **Export**.
