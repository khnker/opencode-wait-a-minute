# Análisis Integral de Comprensión Conversacional y Pragmática en .wam (Wait-A-Minute)

## 1. Introducción y Marco de Evaluación
Este documento presenta el análisis detallado de las trazas, logs e interacciones recolectadas en los archivos `.wam` y sesiones del workspace, evaluando los fallos en la ejecución de los agentes bajo cinco dimensiones críticas:
1. **Comprensión conversacional**: Grado de retención del contexto, hilo discursivo e intenciones del usuario a lo largo de las interacciones.
2. **Comprensión pragmática**: Capacidad para interpretar intenciones más allá del significado literal (indirectas, correcciones implícitas, ajustes de rumbo).
3. **Nivel de comprensión**: Volumen y precisión de la información intercambiada asimilada por el sistema.
4. **Evaluación de comprensión**: Mecanismos y evidencias de medición (o ausencia de ellos) sobre lo que el agente interpretó antes de actuar.
5. **Alineación de entendimiento (Shared Understanding)**: Coincidencia entre lo que el usuario solicita/acuerda y lo que el agente registra como objetivo activo.

---

## 2. Hallazgos por Proyecto / Módulo de Trazas

### A. Módulo de Cognición y Tareas (`test_tmp/` y `.wam/`)
- **Pérdida de Mensajes (Message Loss):**
  - *Evidencia en código/logs:* Se observa en `selection-log.jsonl` que múltiples ejecuciones registran `"sufficiency": "insufficient"` y `selected_ids: []` a pesar de que el usuario había provisto instrucciones previas extensas.
  - *Extracto / Comportamiento:* El agente descarta el contexto histórico al cambiar de fase de inferencia ("Full" -> "Fast" -> "Partial") sin propagar el estado acumulado.
- **Desviación de Objetivos (Goal Deviation):**
  - *Evidencia:* Transiciones abruptas donde el agente ejecuta tareas secundarias o de exploración genérica en lugar de atender la directiva principal del usuario.
- **Frustración y Repetición del Usuario:**
  - *Patrón detectado:* El usuario se ve forzado a repetir comandos de validación o reformular la misma instrucción 3 o más veces porque el agente interpreta la tarea de forma literal pero pierde el objetivo pragmático ("¿Por qué no aplicaste el fix anterior?").

---

## 3. Matriz de Evaluación por Criterio

| Dimensión | Estado Detectado | Impacto en la Experiencia | Evidencia en Trazas / Código |
|---|---|---|---|
| **Comprensión Conversacional** | Débil en multi-turno | Pérdida de contexto entre turnos de subtareas | Logs con `selected_ids: []` tras entradas ricas |
| **Comprensión Pragmática** | Literal / Rígida | Incapacidad para detectar correcciones implícitamente enojadas | Transiciones automáticas sin validación de intención |
| **Nivel de Comprensión** | Parcial | Ejecución incompleta de tareas compuestas | Tareas marcadas como completadas con gaps de evidencia |
| **Evaluación de Comprensión** | Inexistente | Ausencia de checkpoints de confirmación antes de actuar | Ejecución directa sin pre-verificación compartida |
| **Alineación de Entendimiento** | Desalineado | Divergencia entre expectativa del usuario y acción del LLM | Re-intentos manuales constantes y repetición por parte del usuario |

---

## 4. Plan de Control y Cambios OpenSpec

Para mitigar estos problemas, se establece el cambio OpenSpec `wam-comprehension-control` que introduce:
1. **Validación de Alineación Pre-Ejecución:** Obligar al sistema a registrar un resumen de comprensión compartido antes de cada ejecución multi-fase.
2. **Retención de Contexto Pragmático:** Almacenar vectores de intención y señales de corrección del usuario en el store cognitivo.
3. **Mecanismo de Detección de Frustración:** Identificar patrones de repetición de comandos para activar automáticamente un modo de re-alineación guiada.
