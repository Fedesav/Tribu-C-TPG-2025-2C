interface Props {
  value: number;
  onChange: (anio: number) => void;
}

export function YearSelector({ value, onChange }: Props) {
  return (
    <label>
      Año
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: 6 }).map((_, idx) => {
          const year = 2022 + idx;
          return (
            <option key={year} value={year}>
              {year}
            </option>
          );
        })}
      </select>
    </label>
  );
}
