export interface CapacitorErisSosmapPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}
