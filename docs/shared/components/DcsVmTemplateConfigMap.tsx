// Kept for the pages that import the Huawei DCS generator. The generator itself
// is VmTemplateConfigMap, which serves every provider.
import VmTemplateConfigMap, { type VmTemplateConfigMapProps } from './VmTemplateConfigMap.js'

export type DcsVmTemplateConfigMapProps = Omit<VmTemplateConfigMapProps, 'provider'>

export default function DcsVmTemplateConfigMap(props: DcsVmTemplateConfigMapProps) {
  return <VmTemplateConfigMap provider="dcs" {...props} />
}
