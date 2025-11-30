import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type Navigator, UNSAFE_NavigationContext } from 'react-router-dom';
import { bulkUpdateTarifas, BulkTarifaPayload, fetchTarifas } from '../api';
import { RoleTariff } from '../types';
import { TariffGrid, TariffGridColumn, TariffGridRow, DirtyState } from '../components/TariffGrid';
import { Toast, useToast } from '../components/Toast';

interface Props {
  onDirtyChange?: (dirty: boolean) => void;
}

interface ColumnDefinition extends TariffGridColumn {
  year: number;
  month: number;
}

const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'short' });

const buildColumnId = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

const buildColumns = (centerYear: number): ColumnDefinition[] => {
  const defs: ColumnDefinition[] = [
    {
      id: buildColumnId(centerYear - 1, 12),
      year: centerYear - 1,
      month: 12,
      label: `${monthFormatter.format(new Date(centerYear - 1, 11))} ${centerYear - 1}`
    }
  ];

  for (let month = 1; month <= 12; month++) {
    defs.push({
      id: buildColumnId(centerYear, month),
      year: centerYear,
      month,
      label: monthFormatter.format(new Date(centerYear, month - 1))
    });
  }

  defs.push({
    id: buildColumnId(centerYear + 1, 1),
    year: centerYear + 1,
    month: 1,
    label: `${monthFormatter.format(new Date(centerYear + 1, 0))} ${centerYear + 1}`
  });

  return defs;
};

export function TariffsPage({ onDirtyChange }: Props) {
  const { toastMessage, toastType, toastDuration, showToast, hideToast } = useToast();
  const defaultYear = new Date().getFullYear();
  const [anio, setAnio] = useState(defaultYear);
  const [roles, setRoles] = useState<RoleTariff[]>([]);
  const [tableValues, setTableValues] = useState<Record<string, Record<string, number | null>>>({});
  const [baseline, setBaseline] = useState<Record<string, Record<string, number | null>>>({});
  const [dirty, setDirty] = useState<Record<string, Record<string, number | null>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => buildColumns(anio), [anio]);

  const loadData = useCallback(
    async (year: number) => {
      setLoading(true);
      try {
        const [previous, current, next] = await Promise.all([
          fetchTarifas(year - 1),
          fetchTarifas(year),
          fetchTarifas(year + 1)
        ]);

        const roleMap = new Map<string, RoleTariff>();
        const valueMap: Record<string, Record<string, number | null>> = {};

        [previous, current, next].forEach((response) => {
          response.roles.forEach((rol) => {
            if (!roleMap.has(rol.id)) {
              roleMap.set(rol.id, rol);
            }
            const entry = valueMap[rol.id] ?? {};
            Object.entries(rol.valores).forEach(([mes, valor]) => {
              const columnId = buildColumnId(response.anio, Number(mes));
              entry[columnId] = typeof valor === 'number' ? valor : null;
            });
            valueMap[rol.id] = entry;
          });
        });

        const orderedRoles = Array.from(roleMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        const normalizedValues: Record<string, Record<string, number | null>> = {};

        orderedRoles.forEach((rol) => {
          const entry = { ...(valueMap[rol.id] ?? {}) };
          columns.forEach((column) => {
            if (entry[column.id] === undefined) {
              entry[column.id] = null;
            }
          });
          normalizedValues[rol.id] = entry;
        });

        setRoles(orderedRoles);
        setTableValues(normalizedValues);
        setBaseline(JSON.parse(JSON.stringify(normalizedValues)));
        setDirty({});
        setError(null);
        onDirtyChange?.(false);
      } catch (e) {
        setError('No pudimos obtener los datos');
      } finally {
        setLoading(false);
      }
    },
    [columns, onDirtyChange]
  );

  useEffect(() => {
    loadData(anio);
  }, [anio, loadData]);

  const handleChange = (rolId: string, columnId: string, value: number | null) => {
    setTableValues((current) => {
      const next = { ...current };
      const entry = { ...(next[rolId] ?? {}) };
      entry[columnId] = value ?? null;
      next[rolId] = entry;
      return next;
    });

    setDirty((current) => {
      const next = { ...current };
      const roleChanges = { ...(next[rolId] ?? {}) };
      const originalValue = baseline[rolId]?.[columnId] ?? null;
      const normalized = value ?? null;

      if (normalized === (originalValue ?? null)) {
        delete roleChanges[columnId];
      } else {
        roleChanges[columnId] = normalized;
      }

      if (Object.keys(roleChanges).length > 0) {
        next[rolId] = roleChanges;
      } else {
        delete next[rolId];
      }

      return next;
    });
  };

  const hasPendingChanges = Object.keys(dirty).length > 0;

  useEffect(() => {
    onDirtyChange?.(hasPendingChanges);
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasPendingChanges, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange]
  );

  const handleSaveAll = useCallback(async () => {
    const payload: BulkTarifaPayload[] = [];

    Object.entries(dirty).forEach(([rolId, cambios]) => {
      const grouped: Record<number, { valores: Record<number, number>; eliminados: number[] }> = {};

      Object.entries(cambios).forEach(([columnId, valor]) => {
        const [yearStr, monthStr] = columnId.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const bucket = grouped[year] ?? { valores: {}, eliminados: [] };
        if (typeof valor === 'number') {
          bucket.valores[month] = valor;
        } else {
          bucket.eliminados.push(month);
        }
        grouped[year] = bucket;
      });

      Object.entries(grouped).forEach(([yearStr, { valores, eliminados }]) => {
        if (Object.keys(valores).length === 0 && eliminados.length === 0) {
          return;
        }
        payload.push({
          rolId,
          anio: Number(yearStr),
          valores,
          eliminados
        });
      });
    });

    if (payload.length === 0) {
      showToast('No hay cambios para guardar', 'error');
      return;
    }

    try {
      await bulkUpdateTarifas(payload);
      setBaseline((prev) => {
        const next = { ...prev };
        payload.forEach(({ rolId, anio, valores, eliminados }) => {
          const entry = { ...(next[rolId] ?? {}) };
          Object.entries(valores).forEach(([mes, valor]) => {
            entry[buildColumnId(anio, Number(mes))] = valor;
          });
          eliminados?.forEach((mes) => {
            entry[buildColumnId(anio, mes)] = null;
          });
          next[rolId] = entry;
        });
        return next;
      });
      setDirty({});
      onDirtyChange?.(false);
      showToast('Cambios guardados', 'success');
    } catch (e) {
      showToast('Error al guardar', 'error');
    }
  }, [dirty, onDirtyChange, showToast]);

  useUnsavedChangesPrompt(
    hasPendingChanges,
    'Tenés cambios sin guardar. Guardá o confirmá si querés salir de esta página.'
  );

  const changeYear = (delta: number) => {
    const target = anio + delta;
    if (hasPendingChanges) {
      const confirmed = window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos para cambiar de año?');
      if (!confirmed) {
        return;
      }
    }
    setAnio(target);
  };

  const gridRows: TariffGridRow[] = useMemo(() => {
    return roles.map((rol) => {
      const dirtyMap = dirty[rol.id] ?? {};
      return {
        rolId: rol.id,
        label: `${rol.nombre} (${rol.experiencia})`,
        values: columns.map((column) => tableValues[rol.id]?.[column.id] ?? null),
        dirtyStates: columns.map<DirtyState | undefined>((column) => {
          if (dirtyMap[column.id] === undefined) {
            return undefined;
          }
          const baselineValue = baseline[rol.id]?.[column.id] ?? null;
          const currentValue = tableValues[rol.id]?.[column.id] ?? null;
          if (baselineValue === null && currentValue !== null) {
            return 'added';
          }
          if (baselineValue !== null && currentValue === null) {
            return 'removed';
          }
          return 'modified';
        })
      };
    });
  }, [roles, columns, tableValues, dirty, baseline]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (hasPendingChanges) {
          void handleSaveAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSaveAll, hasPendingChanges]);

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div>
          <p className="page-overline">Finanzas · Planeamiento</p>
          <h1>Sueldos y tarifas</h1>
          <p className="hero-subtitle">Actualizá los valores mensuales por rol usando fórmulas estilo Excel.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={handleSaveAll} disabled={!hasPendingChanges}>
            Guardar cambios
          </button>
        </div>
      </section>
      {error && <div className="banner banner-error">{error}</div>}
      <section className="panel content-panel">
        <header className="content-header">
          <div>
            <h2>Plan anual</h2>
            <p>Dic previo · Año corriente · Ene próximo</p>
          </div>
          <div className="content-tools">
            <div className="year-pagination">
              <button onClick={() => changeYear(-1)} aria-label="Año anterior">
                ‹ {anio - 1}
              </button>
              <span className="year-pagination__current">{anio}</span>
              <button onClick={() => changeYear(1)} aria-label="Año siguiente">
                {anio + 1} ›
              </button>
            </div>
          </div>
        </header>
        {loading && (
          <div className="floating-loading" role="status" aria-label="Cargando datos">
            <span className="floating-loading__spinner" aria-hidden="true" />
          </div>
        )}
        {!error && <TariffGrid key={anio} rows={gridRows} columns={columns} onChange={handleChange} />}
      </section>
      <Toast message={toastMessage} type={toastType} duration={toastDuration} onClose={hideToast} />
    </div>
  );
}

type NavigatorWithBlock = Navigator & {
  block: (blocker: (transition: { retry(): void }) => void) => () => void;
};

function useUnsavedChangesPrompt(when: boolean, message: string) {
  const navigationContext = useContext(UNSAFE_NavigationContext) as unknown as { navigator: NavigatorWithBlock } | null;

  useEffect(() => {
    if (!when) {
      return;
    }
    const navigator = navigationContext?.navigator;
    if (!navigator || typeof navigator.block !== 'function') {
      return;
    }
    const unblock = navigator.block((transition) => {
      const shouldLeave = window.confirm(message);
      if (shouldLeave) {
        unblock();
        transition.retry();
      }
    });
    return unblock;
  }, [message, navigationContext, when]);
}
