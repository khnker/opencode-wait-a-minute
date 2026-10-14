import { analyze } from "./src/skills/engine.js";

const prompts = [
  "hola mundo",
  "Implementa un endpoint REST en NestJS para crear usuarios con validación de email y password",
  "Refactoriza la arquitectura para pasar de un monolito a microservicios usando event-driven",
  "¿Cuál es la mejor manera de optimizar el rendimiento de una consulta SQL en una base de datos PostgreSQL?",
  "Crea un componente Angular que muestre una lista de productos y permita filtrarlos por categoría",
  "Necesito que me ayudes a escribir un script de Python que haga scraping de una página web y guarde los resultados en un CSV",
  "Explica cómo funciona el patrón de diseño Singleton y cuándo se debe usar",
  "¿Puedes ayudarme a configurar un pipeline de CI/CD en GitHub Actions para un proyecto de Node.js?",
  "Quiero que me recomiendes algunas libros sobre arquitectura limpia y diseño de sistemas",
  "¿Cuál es la diferencia entre un proceso y un hilo en un sistema operativo?"
];

async function runTests() {
  for (const [i, prompt] of prompts.entries()) {
    console.log(`Testing prompt ${i+1}/${prompts.length}: "${prompt.substring(0, 50)}..."`);
    const start = Date.now();
    try {
      const result = await analyze({ prompt, projectPath: "." });
      const end = Date.now();
      console.log(`  Success in ${end - start}ms`);
    } catch (e) {
      const end = Date.now();
      console.log(`  Error in ${end - start}ms: ${e.message}`);
    }
  }
}

runTests().catch(console.error);
