// El contrato es informativo: se crea ya APPROVED y WAM nunca lo usa como gate
// de aprobación humana. approve/reject quedan como superficie de compatibilidad
// (registran decisión), pero el trabajo continúa en todos los casos.
export function createContract(requirements, verification) {
  return { status: "APPROVED", requirements, verification, unknowns: [], assumptions: [] };
}
export function approveContract(contract) {
  return { ...contract, status: "APPROVED" };
}
export function rejectContract(contract) {
  return { ...contract, status: "REJECTED" };
}
