---
id: notice.welcome_or_disambiguate
name: Notice: welcome or disambiguate generic namespace
purpose: Da la bienvenida al usuario al iniciar una nueva sesión y explica el flujo de trabajo de WAM, incluyendo las fases y puntos de aprobación.
responsibility: Owns the welcome prompt that greets the user, explains the WAM workflow, and asks them to describe their intended task.
consumer: src/integration/message-handler.js
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] Hola. Soy WAM, tu asistente con conciencia de contexto. Voy a acompañarte en esta sesión con un flujo estructurado:

1. **Definir la tarea** — en una frase qué quieres lograr (quedo registrado como tarea).
2. **Proponer contrato** — genero un contrato de requisitos y expectativas.
3. **Solicitar aprobación** — antes de implementar, te pediré que apruebes el contrato (responde "sí" o "no").
4. **Ejecutar fases** — si apruebo, atravieso las fases PROPOSED → IMPLEMENTING → VERIFYING → DONE, informando cada paso.
5. **Puerta de conclusión** — al final, verifica que todos los requisitos estén cubiertos antes de declarar DONE.

Para comenzar, dime en una frase qué quieres lograr y lo guardaré como una tarea desde el próximo mensaje.