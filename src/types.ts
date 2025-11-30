export interface RoleTariff {
  id: string;
  nombre: string;
  experiencia: string;
  valores: Record<number, number | undefined>;
}

export interface TarifaResponse {
  anio: number;
  roles: RoleTariff[];
}

export interface CostResource {
  recursoId: string;
  nombre: string;
  rol: string;
  seniority: string;
  horas: number;
  tarifaHora: number;
  costo: number;
}

export interface MonthlyCost {
  anio: number;
  mes: number;
  horasTotales: number;
  costoTotal: number;
  recursos: CostResource[];
  rolesSinTarifa?: string[];
}

export interface ProjectCost {
  proyectoId: string;
  proyectoNombre: string;
  meses: MonthlyCost[];
}
