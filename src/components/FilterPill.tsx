import { Icon } from "./Icon";

interface FilterPillProps {
  label: string;
  value: string;
  onClick?: () => void;
}

export function FilterPill({ label, value, onClick }: FilterPillProps) {
  return (
    <button className="filter-pill" onClick={onClick} type="button">
      <span className="lbl">{label}:</span>
      <span className="v">{value}</span>
      <Icon name="chevronDown" size={12} />
    </button>
  );
}
