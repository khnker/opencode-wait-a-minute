/**
 * WAM Skill Upstream Sources — single source of truth.
 *
 * Consumido por scripts/build-registry.cjs (escaneo) y
 * scripts/sync-upstream.cjs (clonado/fetch). Mantener una sola
 * definicion para que ambos pasos vean la misma lista.
 */

const SOURCE_CONFIG = [
  {
    id: "github-awesome-copilot",
    repository: "https://github.com/github/awesome-copilot.git",
    trust: "curated",
    ref: "7cce7cfb4b61196c36d7e8eb8475ae84b356b126",
  },
  {
    id: "dietrichgebert-ponytail",
    repository: "https://github.com/dietrichgebert/ponytail.git",
    trust: "curated",
    ref: "b088b2df6e08d4306c6a3c3d575fe38c2d2d2989",
    skillsPath: "skills",
    baseSkills: ["ponytail"],
  },
];

module.exports = { SOURCE_CONFIG };
