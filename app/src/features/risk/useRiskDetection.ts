/*
 * Barrel re-export for backward compatibility.
 * The canonical implementation lives in hooks/useRiskDetection.ts.
 * Any existing import of useRiskDetection from this path continues to work unchanged.
 */
// Re-export from the canonical location for backward compatibility
export { useRiskDetection } from './hooks/useRiskDetection';
