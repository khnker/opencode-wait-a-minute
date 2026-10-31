export function evaluateCompletion(state) {
  const reqs = state.requirements || [];
  const unverified = reqs.filter(r => r.status !== "verified");
  const unresolvedRequirements = unverified.map(r => r.id);
  return {
    blocked: false,
    advisory: true,
    unresolvedRequirements,
    recommendation: unresolvedRequirements.length === 0
      ? "Recomendación: todos los requisitos están verificados."
      : `Recomendación: ${unresolvedRequirements.length} requisito(s) sin verificar (${unresolvedRequirements.join(", ")}) — documentá evidencia o marcalos como no aplicables.`
  };
}
