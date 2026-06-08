import { useState, useCallback } from 'react';
import { findSafestPath, type RoutingNode, type RoutingEdge, type HazardZone } from '../../../services/routingService';

export function useRouting() {
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [isComputing, setIsComputing] = useState(false);

  const computeRoute = useCallback((
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number,
    activeHazards: HazardZone[]
  ) => {
    setIsComputing(true);

    const nodes: { [id: string]: RoutingNode } = {
      'point_A': { id: 'point_A', lat: startLat, lng: startLng },
      'noeud_1': { id: 'noeud_1', lat: startLat + 0.002, lng: startLng + 0.001 },
      'noeud_2': { id: 'noeud_2', lat: startLat - 0.001, lng: startLng + 0.003 },
      'noeud_3': { id: 'noeud_3', lat: destLat - 0.002, lng: destLng - 0.001 },
      'point_B': { id: 'point_B', lat: destLat, lng: destLng }
    };

    const edges: RoutingEdge[] = [
      { from: 'point_A', to: 'noeud_1', distance: 300 },
      { from: 'point_A', to: 'noeud_2', distance: 400 },
      { from: 'noeud_1', to: 'noeud_3', distance: 600 },
      { from: 'noeud_2', to: 'noeud_3', distance: 500 },
      { from: 'noeud_3', to: 'point_B', distance: 200 }
    ];

    const pathNodeIds = findSafestPath(nodes, edges, 'point_A', 'point_B', activeHazards);

    if (pathNodeIds) {
      const coordinates = pathNodeIds.map(id => [nodes[id].lat, nodes[id].lng] as [number, number]);
      setRouteCoordinates(coordinates);
    } else {
      setRouteCoordinates([[startLat, startLng], [destLat, destLng]]);
    }
    
    setIsComputing(false);
  }, []);

  const clearRoute = () => setRouteCoordinates([]);

  return { routeCoordinates, isComputing, computeRoute, clearRoute };
}