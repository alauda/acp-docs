---
weight: 5
sourceSHA: 360f1d74aba0149a308d8eda2f977f5f5784c0d351d6ccc796d58070f5f71a24
---

# Cost Management

Realize cost and resource cost visualization across multiple clusters. Administrators can intuitively understand the cost distribution and resource usage in different clusters, and allocate platform costs according to different business teams. This allows each business team to clearly know their own cost allocation, which helps platform administrators understand the overall cost structure of the platform and take corresponding measures to optimize resource allocation and control costs.

## Terminology

| Term                    | Explanation                                          |
| ----------------------- | --------------------------------------------------- |
| **Usage**               | The actual CPU and memory usage of the container group. |
| **Request**             | The expected request amount for CPU and memory by the container group, which is the amount of resources the container group hopes the system will reserve for it. |
| **\_\_Idle\_\_**       | The idle cost of CPU and memory resources not allocated to any workload. |
| **Allocated**           | The cost of resources allocated to workloads.       |
| **Total**               | The total of the costs allocated and __Idle__ costs per day or hour over a specified time range. |
| **\_\_Unmounted\_\_** | The storage resource cost occupied by persistent volumes (PVs) that have been pre-created but not allocated to any container group. |
| **\_\_Total\_\_**      | The cumulative cost of the total CPU, memory, and storage resources. |
| **\_\_Other\_\_**      | A collection of namespaces that don't belong to any project. |
| **CPU/Memory/Storage Cost** | The total of the **Allocated** cost of CPU/Memory/Storage and their respective **\_\_Idle\_\_** costs. |

## Prerequisites

- Configure the currency units in both the platform and Kubecost. There are three specific schemes:

  |          | Use Case                                                  | Scheme Description                                                                                                                                                                                                                                                     |
  | -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Default Scheme  | Cost data in the platform and Kubecost is **expressed in USD**.     | The currency unit for both the platform and Kubecost defaults to USD, requiring no currency unit replacement or exchange rate calculation.                                                                                                                           |
  | **Recommended Scheme** | Cost data in the platform and Kubecost is **expressed in CNY**.    | By adding a configuration dictionary (ConfigMap) in a designated namespace of the platform, you can set the currency unit to CNY, and set the currency unit in Kubecost to CNY to unify the currency between the platform and Kubecost. For details, refer to [Configuring Currency Units in the Platform and Kubecost](#platkubeis). |
  | Other Scheme  | Cost data in both the platform and Kubecost is **expressed in different currency units**. | By adding a configuration dictionary (ConfigMap) in a designated namespace of the platform, you can set the currency unit and exchange rates, along with the currency unit in Kubecost. For details, refer to [Configuring Currency Units in the Platform and Kubecost](#platkubeis).                            |

- Please customize the hourly unit prices for CPU, memory, and storage. Log in to Kubecost, go to the **Settings** >  **PRICING** page. If **Enable Custom Pricing** is not enabled, default values will be used. If this option is enabled, please fill in the unit prices for CPU, memory, and storage based on actual procurement or usage conditions.

## General Parameters

The cost management for **Platform** or **Cluster** only accounts for cost information of clusters that have successfully deployed the Kubecost plugin; the cost management for **Projects** only accounts for the cost information of all clusters associated with the project where the Kubecost plugin has been successfully deployed.

| Parameter         | Description                                                                                  | Calculation Formula                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total Cost**     | The cumulative fee for all clusters in CPU, memory, and storage resources within a given time range. | Total Cost = CPU Cost + Memory Cost + Storage Cost (excluding disk cost)<ul><li>CPU Cost = Number of CPU cores of all nodes in all clusters with the Kubecost plugin deployed * CPU hourly price * Time.</li><li>Memory Cost = Total memory (in GB) of all nodes in all clusters with the Kubecost plugin deployed * Memory hourly price * Time.</li><li>Storage Cost = Total capacity of all persistent volumes (PVs) with the Kubecost plugin deployed * Storage hourly price * Time.</li></ul>**Note**: If a persistent volume (PV) is not bound to a persistent volume claim (PVC), its storage cost is not calculated. |
| **CPU Efficiency**  | The Usage / Request of container group CPU across all clusters within a given time range.  | CPU Efficiency = Total Usage of all container group CPUs across all clusters that have successfully deployed the Kubecost plugin / Total Request.                                                                                                                                                                                                                |
| **Memory Efficiency**| The Usage / Request of container group memory across all clusters within a given time range. | Memory Efficiency = Total Usage of all container group memory across all clusters that have successfully deployed the Kubecost plugin / Total Request.                                                                                                                                                                                                               |
| **Cost Efficiency** | The cumulative percentage of costs incurred for CPU and memory Usage against the total allocated costs within a specified time frame. | Cost Efficiency = ((CPU Efficiency * CPU Allocated Cost) + (Memory Efficiency * Memory Allocated Cost)) / (CPU Allocated Cost + Memory Allocated Cost)<ul><li>CPU Allocated Cost = max(Usage, Request) * CPU hourly price * Time.</li><li>Memory Allocated Cost = max(Usage, Request) * Memory hourly price * Time.</li></ul> |
| **Cost Details**    | Display the total cost of currently deployed Kubecost clusters within the platform broken down by resource dimensions, primarily CPU, memory, and storage resources. | -                                                                                                                                                                                                                                                                                                         |
| **Cost Trends**     | Display total, __Idle__, and allocated cost information according to the selected time range. | -                                                                                                                                                                                                                                                                                                         |

## Platform Cost Management

Display the cost information of the platform over a specified time range, accounting only for cost information from clusters that have successfully deployed the Kubecost plugin. If all clusters in the current platform have not deployed the Kubecost plugin, all parameters on the page will display as **-** or **No Data**.

### Cost Distribution Line Chart and List

| Parameter          | Cluster Dimension                                                                                                                                                                                                | Project Dimension                                                                                                                                                                                                                                                                              | Calculation Formula                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cost Distribution Line Chart** | Display cost information for clusters that have successfully deployed the Kubecost plugin according to the selected time range.<ul><li>If the selected time range is 7 days: display the cluster cost over the past 7 days with a daily granularity.</li><li>If the selected time range is 1 day: display the cluster cost over the past 24 hours with an hourly granularity.</li></ul>**Note**: If the number of clusters that have successfully deployed the Kubecost plugin exceeds 5, only the top 5 clusters by total cost will be displayed, and you can click the **Legend** on the right to view the cost usage information of each cluster. | Display the project cost information that can be statistically calculated within Kubecost according to the selected time range.<ul><li>If the selected time range is 7 days: display the project cost over the past 7 days with a daily granularity.</li><li>If the selected time range is 1 day: display the project cost over the past 24 hours with an hourly granularity.</li></ul>                       | -                                                                                                                                                                                                                                      |
| **Cost Distribution List**  | Display __Total__, __Idle__, and cost information of all clusters who have deployed or not deployed the Kubecost plugin according to the selected time range, including information on CPU, memory, storage, cost efficiency, and total cost.<br><br>**Tip**: If the cluster has deployed the Kubecost plugin, you can click on the corresponding cluster name to enter the respective cluster's cost page for detailed information. | Display __Total__, __Idle__, __Other__, and project cost information that can be statistically calculated within Kubecost according to the selected time range, including information on associated clusters, CPU, memory, storage, cost efficiency, and total cost.<br><br>**Note**:<ul><li>Only cost information of clusters associated with the project and have successfully deployed the Kubecost plugin will be reported, and will be formatted as: **Clusters successfully deployed with the Kubecost plugin associated with this project** / **All clusters associated with this project**.</li><li>The associated clusters for __Total__, __Idle__, and __Other__ will be displayed as **-**.</li></ul> | <ul><li>CPU (CPU Allocated Cost) = max(Usage, Request) * CPU hourly price * Time.</li><li>Memory (Memory Allocated Cost) = max(Usage, Request) * Memory hourly price * Time.</li><li>Storage (Storage Allocated Cost) = Total capacity of all persistent volumes (PV) * Storage hourly price * Time.</li></ul> |

## Cluster Cost Management

### Cost Distribution Line Chart and List

| Parameter          | Namespace Dimension                                                                                                                                                               | Project Dimension                                                                                                         | Calculation Formula                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cost Distribution Line Chart** | Display the cost information of namespaces under the current cluster according to the selected time range.<br><br>**Note**: If the number of namespaces under the cluster exceeds 5, only the top 5 namespaces by total cost will be displayed, and you can click the **Legend** on the right to view the cost usage information of each namespace. | Display the project cost information that can be statistically calculated within Kubecost for the current cluster according to the selected time range. | -                                                                                                                                                                                                                                      |
| **Cost Distribution List**  | Display __Total__, __Idle__, __Unmounted__, and cost information of all namespaces under this cluster according to the selected time range, including information on CPU, memory, storage, cost efficiency, and total cost.<br><br>**Tip**: You can click on the corresponding namespace name to enter Kubecost and check the detailed cost information for that namespace. | Display __Total__, __Idle__, __Other__, and project cost information that can be statistically calculated within Kubecost for the current cluster according to the selected time range, including information on CPU, memory, storage, cost efficiency, and total cost. | <ul><li>CPU (CPU Allocated Cost) = max(Usage, Request) * CPU hourly price * Time.</li><li>Memory (Memory Allocated Cost) = max(Usage, Request) * Memory hourly price * Time.</li><li>Storage (Storage Allocated Cost) = Total capacity of all persistent volumes (PV) * Storage hourly price * Time.</li></ul> |

## Project Cost Management

### Cost Distribution Line Chart and List

| Parameter          | Namespace Dimension                                                                                                                                                                        | Calculation Formula                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cost Distribution Line Chart** | Display the cost information of all namespaces under the current project according to the selected time range.<br><br>**Note**: If the number of namespaces under the project exceeds 5, only the top 5 namespaces by total cost will be displayed, and you can click the **Legend** on the right to view the cost usage information of each namespace. | -                                                                                                                                                                                                                                      |
| **Cost Distribution List**  | Display __Total__, __Idle__, and cost information of all namespaces under the project according to the selected time range, including information on associated clusters, CPU, memory, storage, cost efficiency, and total cost.<br><br>**Note**:<ul><li>You can click on the corresponding namespace name to enter Kubecost and view the detailed cost information for that namespace.</li><li>Associated clusters indicate the clusters to which the namespaces under this project belong; if the clusters associated with this project have not deployed the Kubecost plugin, the namespaces under those clusters will not be displayed.</li></ul> | <ul><li>CPU (CPU Allocated Cost) = max(Usage, Request) * CPU hourly price * Time.</li><li>Memory (Memory Allocated Cost) = max(Usage, Request) * Memory hourly price * Time.</li><li>Storage (Storage Allocated Cost) = Total capacity of all persistent volumes (PV) * Storage hourly price * Time.</li></ul> |

## <span id="platkubeis">Related Operations</span>

### Configure the Currency Units in the Platform

1. In the left navigation pane, click **Cluster Management** > **Resource Management**.

2. Switch to **global cluster**.

3. Click **Create Resource Object**, and add a new YAML configuration file, as shown below.

       apiVersion: v1
       kind: ConfigMap
       metadata:  
         name: costmanager-currency  
         namespace: finops-system    
       data:  
         rate: '1'  
         unit: '¥'   

   **Field Descriptions**:

   | Field                     | Description                                                                                              |
   | ------------------------- | -------------------------------------------------------------------------------------------------------- |
   | **metadata.name**        | This field must be specified as `costmanager-currency`, and cannot be modified.                                       |
   | **metadata.namespace**    | This field must be specified as `finops-system`, and cannot be modified.                                         |
   | **data.rate**            | The exchange rate used in the platform; if this field is not specified, it defaults to 1.<br><br>**Note**: If the currency units in the platform and Kubecost differ, this must be converted according to real-time exchange rates. For example: if the platform uses CNY while Kubecost uses USD, based on the current exchange rate, this field should be filled in as 7.1409. |
   | **data.unit**            | The currency unit used in the platform. **¥** indicates that the platform uses CNY as the currency unit, and **$** indicates that the platform uses USD as the currency unit.  |

4. Click **Create** and reload the page.

### Configure the Currency Units in Kubecost

1. Log in to Kubecost.

2. Click **Settings** at the bottom left corner of the page.

3. Click **GENERAL** > **Cloud Cost Settings** > In the Currency field's drop-down menu, select **CNY**.

   **Note**: **CNY** indicates the use of CNY as the currency unit for Kubecost, while **USD** indicates the use of USD as the currency unit for Kubecost.

4. Click **SAVE** at the bottom of the page to save your configuration and reload the page.
