import { Fragment, useEffect, useMemo, useState } from 'react';
import { fetchCostos } from '../api';
import { ProjectCost, MonthlyCost } from '../types';

const currency = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fullCurrency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' });
const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type ProjectCostWithMap = ProjectCost & {
  monthMap: Record<number, number>;
  detailMap: Record<number, MonthlyCost>;
  total: number;
};

const compact = (value: number) => {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
};

export function CostsPage() {
  const [costos, setCostos] = useState<ProjectCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    fetchCostos()
      .then((data) => {
        setCostos(data);
        setError(null);
      })
      .catch(() => setError('No pudimos obtener los costos'))
      .finally(() => setLoading(false));
  }, []);

  const monthlyData: ProjectCostWithMap[] = useMemo(() => {
    return costos.map((proyecto) => {
      const monthMap: Record<number, number> = {};
      const detailMap: Record<number, MonthlyCost> = {};
      proyecto.meses.forEach((mes) => {
        monthMap[mes.mes] = mes.costoTotal;
        detailMap[mes.mes] = mes;
      });
      const total = proyecto.meses.reduce((acc, mes) => acc + mes.costoTotal, 0);
      return { ...proyecto, monthMap, detailMap, total };
    });
  }, [costos]);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div>
          <p className="page-overline">Finanzas · Seguimiento</p>
          <h1>Carga de costos mensual</h1>
          <p className="hero-subtitle">Seguimiento consolidado de cada iniciativa · Valores en USD</p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button">Guardar borrador</button>
          <button className="primary-button">Enviar para aprobación</button>
        </div>
      </section>
      {error && <div className="banner banner-error">{error}</div>}
      <section className="panel content-panel">
        <header className="content-header">
          <div>
            <h2>Resumen por proyecto</h2>
            <p>Compará mes a mes la evolución del costo mensual.</p>
          </div>
          <div className="content-tools">
            <button className="secondary-button ghost" type="button">
              Exportar reporte
            </button>
          </div>
        </header>
        {loading && <p>Cargando costos...</p>}
        <div className="costs-table-scroll">
          <div className="costs-table-wrapper">
            <table className="costs-table">
          <thead>
            <tr>
              <th>Proyecto</th>
              {monthLabels.map((label) => (
                <th key={label}>{label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((proyecto, rowIdx) => (
              <Fragment key={proyecto.proyectoId}>
                <tr className={`project-row ${rowIdx % 2 === 0 ? 'is-odd' : ''}`}>
                  <td>
                    <button className="project-toggle" onClick={() => toggle(proyecto.proyectoId)} aria-label="Alternar detalle">
                      <span>{expanded[proyecto.proyectoId] ? '▾' : '▸'}</span>
                    </button>
                    <div className="project-info">
                      <strong>{proyecto.proyectoNombre}</strong>
                      <span>{proyecto.proyectoId}</span>
                    </div>
                  </td>
                  {monthLabels.map((_, idx) => {
                    const monthIndex = idx + 1;
                    const monthDetail = proyecto.detailMap[monthIndex];
                    const amount = monthDetail?.costoTotal ?? null;
                    const warnings = monthDetail?.rolesSinTarifa ?? [];
                    const pillClasses = ['month-pill'];
                    if (amount) pillClasses.push('has-value');
                    if (warnings.length) pillClasses.push('warning');
                    return (
                      <td key={`${proyecto.proyectoId}-${monthIndex}`}>
                        <div className={pillClasses.join(' ')}>
                          {amount || warnings.length ? (
                            <span
                              className="amount-pill"
                              onMouseEnter={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                const showAbove = rect.top > window.innerHeight / 2;
                                const topPosition = showAbove ? rect.top - 8 : rect.bottom + 8;
                                event.currentTarget.style.setProperty('--tooltip-left', `${rect.left + rect.width / 2}px`);
                                event.currentTarget.style.setProperty('--tooltip-top', `${topPosition}px`);
                                event.currentTarget.style.setProperty('--tooltip-shift', showAbove ? '-100%' : '0');
                              }}
                              onMouseLeave={(event) => {
                                event.currentTarget.style.removeProperty('--tooltip-left');
                                event.currentTarget.style.removeProperty('--tooltip-top');
                                event.currentTarget.style.removeProperty('--tooltip-shift');
                              }}
                            >
                              {amount ? compact(amount) : warnings.length ? '!' : '-'}
                              <span className="amount-tooltip">
                                {(() => {
                                  const monthDetail = proyecto.meses.find((mes) => mes.mes === monthIndex);
                                  if (!monthDetail) {
                                    return null;
                                  }
                                  const monthLabel = new Date(2000, monthDetail.mes - 1).toLocaleString('es-AR', {
                                    month: 'long'
                                  });
                                  const formattedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
                                  return (
                                    <>
                                      <strong>
                                        {formattedMonth} {monthDetail.anio}
                                      </strong>
                                      <div className="month-hours">Horas: {monthDetail.horasTotales.toFixed(1)}</div>
                                      <div className="month-total">{fullCurrency.format(monthDetail.costoTotal)}</div>
                                      {monthDetail.rolesSinTarifa?.length ? (
                                        <div className="month-warning">
                                          Roles sin tarifa: {monthDetail.rolesSinTarifa.join(', ')}
                                        </div>
                                      ) : null}
                                      <ul>
                                        {monthDetail.recursos.map((r) => {
                                          const truncatedTarifa = Math.trunc(r.tarifaHora);
                                          const truncatedCosto = Math.trunc(r.costo);
                                          const showWarning = truncatedTarifa === 0;
                                          return (
                                            <li key={`${monthIndex}-${r.recursoId}`}>
                                              {r.nombre}: {r.horas.toFixed(1)}h x{' '}
                                              {showWarning ? (
                                                <span className="tarifa-missing">!?</span>
                                              ) : (
                                                compact(truncatedTarifa)
                                              )}{' '}
                                              = {compact(truncatedCosto)}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </>
                                  );
                                })()}
                              </span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="cell-total">
                    <span className="month-pill has-value">{compact(proyecto.total)}</span>
                  </td>
                </tr>
                {expanded[proyecto.proyectoId] && (
                  <tr className="project-detail">
                    <td colSpan={monthLabels.length + 2}>
                      <div className="resources-grid">
                        <div className="resources-grid__header">
                          <span>Periodo</span>
                          <span>Recurso</span>
                          <span>Rol</span>
                          <span>Seniority</span>
                          <span>Horas</span>
                          <span>Sueldo</span>
                          <span>Costo</span>
                        </div>
                        {proyecto.meses.flatMap((mes) =>
                          mes.recursos.map((recurso) => (
                            <div className="resources-grid__row" key={`${mes.anio}-${mes.mes}-${recurso.recursoId}`}>
                              <span>
                                {mes.mes.toString().padStart(2, '0')}/{mes.anio}
                              </span>
                              <span className="resource-name">{recurso.nombre}</span>
                              <span className="resource-role">{recurso.rol}</span>
                              <span className="resource-seniority">{recurso.seniority}</span>
                              <span>{recurso.horas.toFixed(1)}</span>
                              <span>{currency.format(recurso.tarifaHora)}</span>
                              <span>{currency.format(recurso.costo)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
        </div>
      </section>
      {!loading && costos.length === 0 && <p>No hay costos registrados para mostrar.</p>}
    </div>
  );
}
