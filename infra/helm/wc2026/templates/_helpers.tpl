{{- define "wc2026.name" -}}
{{- default "wc2026" .Values.nameOverride -}}
{{- end -}}

{{- define "wc2026.labels" -}}
app.kubernetes.io/part-of: wc2026
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.environment }}
{{- end -}}

{{- define "wc2026.apiImage" -}}
{{- if .Values.image.registry -}}
{{ printf "%s/%s:%s" .Values.image.registry .Values.image.api.repository .Values.image.api.tag }}
{{- else -}}
{{ printf "%s:%s" .Values.image.api.repository .Values.image.api.tag }}
{{- end -}}
{{- end -}}

{{- define "wc2026.webImage" -}}
{{- if .Values.image.registry -}}
{{ printf "%s/%s:%s" .Values.image.registry .Values.image.web.repository .Values.image.web.tag }}
{{- else -}}
{{ printf "%s:%s" .Values.image.web.repository .Values.image.web.tag }}
{{- end -}}
{{- end -}}

{{/* Name of the Secret holding SESSION_SIGNING_SECRET + FOOTBALL_DATA_TOKEN.

  Guard: if the chart neither creates the Secret (secret.create=false) nor is pointed at an
  existing one (secret.existingSecret=""), every workload would reference a Secret that does
  not exist and silently CrashLoop / fail to mount. Fail the render fast with a clear message
  instead of producing a dangling reference. */}}
{{- define "wc2026.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{ .Values.secret.existingSecret }}
{{- else if .Values.secret.create -}}
{{ printf "wc2026-%s-secrets" .Values.environment }}
{{- else -}}
{{ required "A Secret is required: set secret.existingSecret to a pre-provisioned Secret (e.g. external-secrets), or set secret.create=true to have the chart create one." .Values.secret.existingSecret }}
{{- end -}}
{{- end -}}
