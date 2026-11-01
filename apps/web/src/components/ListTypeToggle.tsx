import { memo, type PointerEvent } from "react";
import { listTypes, type ListType } from "@golist/shared/domain/types";
import { useI18n } from "../i18n";

type ListTypeToggleProps = {
  value: ListType;
  onChange: (listType: ListType) => void;
};

// Keeps focus where it is (the header's rename input saves on blur).
const keepFocus = (event: PointerEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

/** Shopping / todo segmented control. */
const ListTypeToggle = memo(function ListTypeToggle({ value, onChange }: ListTypeToggleProps) {
  const { t } = useI18n();

  return (
    <div className="list-type-toggle" role="radiogroup" aria-label={t("listType.label")}>
      {listTypes.map((listType) => (
        <button
          key={listType}
          type="button"
          role="radio"
          aria-checked={value === listType}
          className={`list-type-toggle__option${value === listType ? " list-type-toggle__option--active" : ""}`}
          onPointerDown={keepFocus}
          onClick={() => onChange(listType)}
        >
          {t(`listType.${listType}`)}
        </button>
      ))}
    </div>
  );
});

export default ListTypeToggle;
