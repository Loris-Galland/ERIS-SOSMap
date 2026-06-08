export interface RoutingNode {
  id: string;
  lat: number;
  lng: number;
}

export interface RoutingEdge {
  from: string;
  to: string;
  distance: number;
}

export interface HazardZone {
  id: string;
  latitude: number;
  longitude: number;
  radius?: number; 
  type: string;
}

export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; 
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getHazardPenalty(nodeA: RoutingNode, nodeB: RoutingNode, hazards: HazardZone[]): number {
  let penaltyFactor = 1;
  const midLat = (nodeA.lat + nodeB.lat) / 2;
  const midLng = (nodeA.lng + nodeB.lng) / 2;

  for (const hazard of hazards) {
    const distanceToHazard = getHaversineDistance(midLat, midLng, hazard.latitude, hazard.longitude);
    const dangerRadius = hazard.radius || 150; 

    if (distanceToHazard <= dangerRadius) {
      if (hazard.type === 'incendie' || hazard.type === 'route_bloquee') {
        return Infinity;
      }
      penaltyFactor += 10;
    }
  }
  return penaltyFactor;
}

export function findSafestPath(
  nodes: { [id: string]: RoutingNode },
  edges: RoutingEdge[],
  startNodeId: string,
  endNodeId: string,
  hazards: HazardZone[]
): string[] | null {
  const distances: { [id: string]: number } = {};
  const previous: { [id: string]: string | null } = {};
  const queue = new Set<string>();

  for (const nodeId in nodes) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
    queue.add(nodeId);
  }
  distances[startNodeId] = 0;

  while (queue.size > 0) {
    let minNodeId: string | null = null;
    for (const nodeId of queue) {
      if (minNodeId === null || distances[nodeId] < distances[minNodeId]) {
        minNodeId = nodeId;
      }
    }

    if (minNodeId === null || distances[minNodeId] === Infinity) break;
    if (minNodeId === endNodeId) break; 

    queue.delete(minNodeId);

    const currentNeighbors = edges.filter(e => e.from === minNodeId || e.to === minNodeId);

    for (const edge of currentNeighbors) {
      const neighborId = edge.from === minNodeId ? edge.to : edge.from;
      if (!queue.has(neighborId)) continue;

      const nodeA = nodes[minNodeId];
      const nodeB = nodes[neighborId];
      
      const penalty = getHazardPenalty(nodeA, nodeB, hazards);
      if (penalty === Infinity) continue; 

      const alt = distances[minNodeId] + edge.distance * penalty;

      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        previous[neighborId] = minNodeId;
      }
    }
  }

  const path: string[] = [];
  let current: string | null = endNodeId;

  if (previous[current] === null && current !== startNodeId) return null;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  return path;
}