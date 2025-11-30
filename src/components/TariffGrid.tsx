import { useEffect, useMemo, useRef, useCallback } from 'react';
import 'handsontable/dist/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import HyperFormula from 'hyperformula';

registerAllModules();

export type DirtyState = 'added' | 'modified' | 'removed';

interface Props {
  rows: TariffGridRow[];
  columns: TariffGridColumn[];
  onChange: (rolId: string, columnId: string, value: number | null) => void;
}

export interface TariffGridColumn {
  id: string;
  label: string;
}

export interface TariffGridRow {
  rolId: string;
  label: string;
  values: (number | null)[];
  dirtyStates?: Array<DirtyState | null | undefined>;
}

export function TariffGrid({ rows, columns, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hotRef = useRef<Handsontable | null>(null);
  const engineRef = useRef<HyperFormula | null>(null);
  const rowIdsRef = useRef<string[]>(rows.map((row) => row.rolId));
  const columnIdsRef = useRef<string[]>(columns.map((column) => column.id));
  const onChangeRef = useRef(onChange);
  const dirtyMapRef = useRef<Record<string, Array<DirtyState | null | undefined>>>({});
  const activeCellRef = useRef<{ row: number; col: number } | null>(null);
  const formulaCacheRef = useRef<Record<string, Record<string, string>>>({});
  const syncingRef = useRef(false);

  useEffect(() => {
    rowIdsRef.current = rows.map((row) => row.rolId);
    const map: Record<string, Array<DirtyState | null | undefined>> = {};
    rows.forEach((row) => {
      map[row.rolId] = row.dirtyStates ?? [];
    });
    dirtyMapRef.current = map;
  }, [rows]);

  useEffect(() => {
    columnIdsRef.current = columns.map((column) => column.id);
  }, [columns]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat('es-AR', { month: 'short' }), []);

  const currentMonthColumnId = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const colHeaders = useMemo(() => {
    return [
      'Rol',
      ...columns.map((column) => column.label)
    ];
  }, [columns]);

  const updateFormulaFromCell = useCallback((row: number, col: number) => {
    if (!hotRef.current || row < 0 || col < 0) {
      activeCellRef.current = null;
      activeCellRef.current = null;
      return;
    }
    activeCellRef.current = { row, col };
  }, []);

  const getFormulaFromCell = useCallback((row: number, col: number) => {
    const hot = hotRef.current;
    if (!hot) {
      return null;
    }
    const formulasPlugin = (hot.getPlugin('formulas') as any) ?? null;
    if (!formulasPlugin || formulasPlugin.sheetId == null) {
      return null;
    }
    const hfRow = formulasPlugin.rowAxisSyncer?.getHfIndexFromVisualIndex?.(row);
    const hfCol = formulasPlugin.columnAxisSyncer?.getHfIndexFromVisualIndex?.(col);
    if (!Number.isFinite(hfRow) || !Number.isFinite(hfCol)) {
      return null;
    }
    const serialized = formulasPlugin.engine?.getCellSerialized({
      sheet: formulasPlugin.sheetId,
      row: hfRow,
      col: hfCol
    });
    if (typeof serialized === 'string' && serialized.trim().startsWith('=')) {
      return serialized.trim();
    }
    return null;
  }, []);

  const composeDataset = useCallback(() => {
    return rows.map((row) => {
      const cache = formulaCacheRef.current[row.rolId] ?? {};
      const values = columns.map((column, columnIndex) => {
        const formula = cache[column.id];
        if (formula) {
          return formula;
        }
        const cellValue = row.values[columnIndex];
        if (typeof cellValue === 'number') {
          return cellValue;
        }
        return cellValue ?? null;
      });
      return [row.label, ...values];
    });
  }, [rows, columns]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const engine = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });
    engineRef.current = engine;

    const hot = new Handsontable(containerRef.current, {
      data: composeDataset(),
      rowHeaders: true,
      colHeaders,
      formulas: { engine: engine as any },
      licenseKey: 'non-commercial-and-evaluation',
      height: 'auto',
      stretchH: 'all',
      cells(row, col) {
        if (col === 0) {
          return { readOnly: true, className: 'role-cell' };
        }
        const rolId = rowIdsRef.current[row];
        const dirtyStates = rolId ? dirtyMapRef.current[rolId] : undefined;
        const state = dirtyStates?.[col - 1];
        const columnId = columnIdsRef.current[col - 1];
        const classes: string[] = [];
        if (columnId && columnId === currentMonthColumnId) {
          classes.push('current-month-cell');
        }
        if (state) {
          classes.push(
            state === 'added' ? 'dirty-cell new-value' : state === 'removed' ? 'dirty-cell removed-value' : 'dirty-cell'
          );
        }
        if (classes.length > 0) {
          return { className: classes.join(' ') };
        }
        return {};
      },
      afterGetColHeader(col, TH) {
        TH.classList.remove('current-month-header');
        if (col <= 0) {
          return;
        }
        const columnId = columnIdsRef.current[col - 1];
        if (columnId && columnId === currentMonthColumnId) {
          TH.classList.add('current-month-header');
        }
      },
      beforeOnCellMouseDown(this: Handsontable, event, coords, TD, controller) {
        if (coords.col < 0) {
          return;
        }
        const activeEditor = this.getActiveEditor();
        if (!activeEditor) {
          return;
        }
        if (!activeEditor.isOpened()) {
          return;
        }
        if (event.target === (activeEditor as any).TEXTAREA) {
          return;
        }

        const textarea = (activeEditor as any).TEXTAREA as HTMLTextAreaElement | undefined;
        if (!textarea) {
          return;
        }

        if ((textarea.value || '').trim().startsWith('=')) {
          event.preventDefault();
          event.stopPropagation();
          (event as any).stopImmediatePropagation?.();

          if (controller) {
            (controller as any).row = false;
            (controller as any).column = false;
            (controller as any).cell = false;
            (controller as any).cells = true;
          }

          const spreadsheetAddress = `${Handsontable.helper.spreadsheetColumnLabel(coords.col)}${coords.row + 1}`;
          textarea.value += spreadsheetAddress;
          setTimeout(() => {
            textarea.focus();
            activeEditor.focus();
          }, 0);
        }
      },
      afterOnCellMouseUp(this: Handsontable) {
        const activeEditor = this.getActiveEditor();
        if (!activeEditor) {
          return;
        }
        if (!activeEditor.isOpened()) {
          return;
        }
        const textarea = (activeEditor as any).TEXTAREA as HTMLTextAreaElement | undefined;
        const currentEvent = window.event as MouseEvent | undefined;
        if (textarea && currentEvent?.target === textarea) {
          return;
        }
        activeEditor.focus();
      },
      afterSelectionEnd(this: Handsontable, row, column) {
        updateFormulaFromCell(row, column);
      },
      afterChange(this: Handsontable, changes, source) {
        if (!changes || source === 'loadData' || syncingRef.current) {
          return;
        }
        changes.forEach(([row, col, , newValue]) => {
          const columnIndex = typeof col === 'number' ? col : Number(col);
          if (!Number.isFinite(columnIndex) || columnIndex === 0) {
            return;
          }
          const rolId = rowIdsRef.current[row];
          const columnId = columnIdsRef.current[columnIndex - 1];
          if (!rolId || !columnId) {
            return;
          }
          const currentFormula = getFormulaFromCell(row, columnIndex);
          if (currentFormula) {
            const roleCache = formulaCacheRef.current[rolId] ?? {};
            roleCache[columnId] = currentFormula;
            formulaCacheRef.current[rolId] = roleCache;
            return;
          } else if (formulaCacheRef.current[rolId]?.[columnId]) {
            delete formulaCacheRef.current[rolId][columnId];
            if (Object.keys(formulaCacheRef.current[rolId]).length === 0) {
              delete formulaCacheRef.current[rolId];
            }
          }
          if (typeof newValue === 'string' && newValue.trim().startsWith('=')) {
            const trimmed = newValue.trim();
            const roleCache = formulaCacheRef.current[rolId] ?? {};
            roleCache[columnId] = trimmed;
            formulaCacheRef.current[rolId] = roleCache;
            return;
          } else if (formulaCacheRef.current[rolId]?.[columnId]) {
            delete formulaCacheRef.current[rolId][columnId];
            if (Object.keys(formulaCacheRef.current[rolId]).length === 0) {
              delete formulaCacheRef.current[rolId];
            }
          }
          const numeric = newValue === null || newValue === '' ? null : Number(newValue);
          const parsed = numeric === null || Number.isFinite(numeric) ? numeric : null;
          onChangeRef.current?.(rolId, columnId, parsed);
        });
      },
      afterFormulasValuesUpdate(this: Handsontable, changes) {
        if (!changes || syncingRef.current) {
          return;
        }
        changes.forEach(({ address, value }: any) => {
          const col = address?.col;
          const row = address?.row;
          if (!Number.isFinite(col) || !Number.isFinite(row) || col === 0) {
            return;
          }
          const rolId = rowIdsRef.current[row];
          const columnId = columnIdsRef.current[col - 1];
          if (!rolId || !columnId) {
            return;
          }
          const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
          onChangeRef.current?.(rolId, columnId, numeric);
        });
      },
      afterBeginEditing(this: Handsontable, row, column) {
        if (column === 0) {
          return;
        }
        const rolId = rowIdsRef.current[row];
        const columnId = columnIdsRef.current[column - 1];
        if (!rolId || !columnId) {
          return;
        }
        const formula = formulaCacheRef.current[rolId]?.[columnId];
        if (!formula) {
          return;
        }
        const editor = this.getActiveEditor();
        if (!editor || typeof (editor as any).setValue !== 'function') {
          return;
        }
        (editor as any).setValue(formula);
        const textarea = (editor as any).TEXTAREA as HTMLTextAreaElement | undefined;
        if (textarea) {
          requestAnimationFrame(() => {
            textarea.selectionStart = formula.length;
            textarea.selectionEnd = formula.length;
          });
        }
      }
    });

    hotRef.current = hot;

    return () => {
      hot.destroy();
      hotRef.current = null;
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks-exhaustive-deps

  useEffect(() => {
    if (!hotRef.current) {
      return;
    }
    const dataset = composeDataset();
    syncingRef.current = true;
    hotRef.current.updateSettings({ colHeaders });
    hotRef.current.loadData(dataset);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
    if (activeCellRef.current) {
      const { row, col } = activeCellRef.current;
      updateFormulaFromCell(row, col);
    }
  }, [colHeaders, composeDataset, updateFormulaFromCell]);

  return <div id="tariffs-grid" className="handsontable ht-theme-horizon" ref={containerRef} />;
}
