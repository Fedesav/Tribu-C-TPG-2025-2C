import { TarifaResponse, ProjectCost } from './types';

const rawBaseUrl = import.meta.env.VITE_API_URL?.trim();
const BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/$/, '') : '';
const buildUrl = (path: string) => `${BASE_URL}${path}`;

export async function fetchTarifas(anio: number): Promise<TarifaResponse> {
  const res = await fetch(`${buildUrl('/api/tarifas')}?anio=${anio}`);
  if (!res.ok) {
    throw new Error('No se pudo obtener las tarifas');
  }
  return res.json();
}

export async function fetchCostos(): Promise<ProjectCost[]> {
  const res = await fetch(buildUrl('/api/costos'));
  if (!res.ok) {
    throw new Error('No se pudo obtener los costos');
  }
  return res.json();
}

export async function updateTarifas(
  rolId: string,
  anio: number,
  valores: Record<number, number>
): Promise<void> {
  const res = await fetch(buildUrl(`/api/tarifas/${rolId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anio, valores })
  });
  if (!res.ok) {
    throw new Error('Error al guardar las tarifas');
  }
}

export interface BulkTarifaPayload {
  rolId: string;
  anio: number;
  valores: Record<number, number>;
  eliminados?: number[];
}

export async function bulkUpdateTarifas(payload: BulkTarifaPayload[]): Promise<void> {
  if (!payload.length) {
    return;
  }
  const res = await fetch(buildUrl('/api/tarifas'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error('Error al guardar las tarifas');
  }
}
