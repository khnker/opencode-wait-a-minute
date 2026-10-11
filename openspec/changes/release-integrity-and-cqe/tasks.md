# CHANGE 01 — Release Integrity and CQE Distribution — Tasks

## Tasks List

### [T-01] Implement CQE dependency strategy
- Implementar `scripts/dependency-resolve.mjs` que:
  - Intenta resolver `context-query-core` desde npm
  - Si falla, incluye CQE directamente de `../context-query-core/src`
  - Declara la dependencia en `package.json` de acuerdo con la estrategia elegida
  - Documentar `CQE_EXPERIMENTAL=true` si se usa modo bundled
- Agregar manifiesto y evidencia en `docs/benchmarks/cqe-distribution.md`

### [T-02] Crear script de verificación de paquete
- Implementar `scripts/verify-package.mjs`:
  - Ejecutar `npm pack`
  - Extraer tarball a `/tmp/wam-verify-XXXXXX`
  - Installar con `npm install`
  - Importar el plugin verificado (utilizar `path.resolve` de node)
  - Instanciar y ejecutar hooks reales con mínimo `/tmp/fixtures`
  - Validar modo CQE: disabled/absent/configurado
  - Asserts de mocha (fallar si es diferente)
  - Limpiar directorio temporal aunque falle un assert
  - Reportar diff del artefacto y pasos
- Probar localmente con `node scripts/verify-package.mjs`

### [T-03] Integrar verificación con CI existente
- Añadir paso `npm run bench:verify` a `scripts/verify-package.mjs`
- Probar si pasa en `scripts/run-tests.mjs`
- Agregar error `bench:verify` al script CI para fallar la compilación

### [T-04] Garantizar independencia del checkout
- Instalar un paquete limpio en `/tmp/wam-cqe-test`
- Ejecutar un import de runtime real sin conexión al checkout original
- Ejecutar hooks con fixtures que existen solo dentro del tarball instalado
- No debe resolver `../context-query-core` como ruta externa al directorio temporal

### [T-05] Validar aceptación y requisitos
- Ejecutar `npm run bench:verify` exitosamente
- Confirmar `npm test` y `openspec validate --all --strict` en CI pasaron
- Ejecutar `node scripts/verify-package.mjs` en PR de release
- Registrar la versión de CQE resolviendo la estrategia

## Criterios de aceptación
- El paquete WAM se instala correctamente sin checkout original
- La verificación de paquetes garantiza que CQE esté presente según lo declarado
- El pipeline CI falla explícitamente si el artefacto no es distribuible
- La verificación del artefacto está aislada del checkout original