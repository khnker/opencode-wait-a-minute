---
id: notice.welcome_or_disambiguate
name: Notice: welcome or disambiguate generic namespace
purpose: Da la bienvenida al usuario al iniciar una nueva sesión y le invita a describir la tarea que desea realizar.
responsibility: Owns the welcome prompt that greets the user and asks them to describe their intended task.
consumer: src/integration/message-handler.js
inputs: []
output: single-line string
restrictions: must match previous literal exactly
verification: src/prompts/characterization.test.mjs
dependencies: []
status: active
---
[wait-a-minute] Hola. Soy tu asistente WAM. Para comenzar, dime en una frase qué quieres lograr y lo guardaré como una tarea desde el próximo mensaje.