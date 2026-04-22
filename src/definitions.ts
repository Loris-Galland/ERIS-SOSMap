export interface CapacitorErisSosmapPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;

  // Trigger the native emergency process
  triggerEmergency(options: { 
    latitude: number; 
    longitude: number; 
    userId: string 
  }): Promise<{ success: boolean; transmissionMethod: string }>;
  
}
