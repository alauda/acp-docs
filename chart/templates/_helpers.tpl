{{/*
Get the trimmed path prefix
*/}}
{{- define "trimmed_online_docs_prefix" -}}
{{- trimSuffix "/" (trimPrefix "/" .Values.productDocs.ingress.online_docs_prefix) -}}
{{- end }} 