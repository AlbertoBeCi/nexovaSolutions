"""
nexova_shared — logica de dominio Python compartida del monorepo Nexova.

Paquete instalable (`uv`/`pip`) para que los distintos servicios/scripts en
Python (scripts/, services/api/, services/incident-manager-api/) importen
la MISMA logica de validacion en vez de mantener copias propias. Vive en
packages/ (no en shared/) porque lo consumen 2+ carpetas, siguiendo el
modelo mental de AGENTS.md.

Submodulos:
- incidents_analysis: reglas de validacion + metricas del ANALIZADOR de
  CSVs de tickets de soporte (scripts/analyze.py, POST /api/incidents/analyze).
  Es el modulo historico, movido aqui tal cual desde shared/incidents_analysis.py.
- incident_constants: enums/etiquetas/transiciones del GESTOR DE INCIDENCIAS
  (modelo persistente, distinto del analizador de arriba).
- incident_validation: validate_incident() e is_valid_transition() del
  gestor de incidencias.
- csv_mapping: mapeo de una fila del CSV del analizador a los campos del
  modelo Incident del gestor (usado por scripts/seed_incidents.py).
"""
