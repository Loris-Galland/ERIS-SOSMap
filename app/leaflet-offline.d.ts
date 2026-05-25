import * as L from 'leaflet';

declare module 'leaflet' {
  namespace TileLayer {
    export function offline(urlTemplate: string, options?: any): any;
  }
  namespace control {
    export function savetiles(baseLayer: any, options?: any): any;
  }
}
