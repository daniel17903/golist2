import { memo, useEffect, useMemo, useRef } from "react";
import { getItemIcon } from "../domain/categories";
import { parseItemInput } from "../domain/inputParser";
import { useI18n } from "../i18n";
import type { Locale } from "../i18n/config";

type AddItemDialogProps = {
  isOpen: boolean;
  itemName: string;
  suggestions: string[];
  duplicatePreview: {
    name: string;
    quantityOrUnit?: string;
  } | null;
  onItemNameChange: (value: string) => void;
  onClose: () => void;
  onAddItem: () => void;
  onAddSuggestion: (name: string, quantityOrUnit?: string) => void;
};

type DuplicatePreviewCardProps = {
  name: string;
  quantityOrUnit?: string;
  locale: Locale;
  duplicateWarningLabel: string;
  duplicateAriaLabel: string;
  onAddSuggestion: (name: string, quantityOrUnit?: string) => void;
};

const DuplicatePreviewCard = memo(({
  name,
  quantityOrUnit,
  locale,
  duplicateWarningLabel,
  duplicateAriaLabel,
  onAddSuggestion,
}: DuplicatePreviewCardProps) => (
  <button
    type="button"
    className="item-card item-card--dialog item-card--duplicate"
    aria-label={duplicateAriaLabel}
    onClick={() => {
      void onAddSuggestion(name, quantityOrUnit);
    }}
  >
    <span className="item-icon" aria-hidden="true">
      <img src={getItemIcon(name, locale)} alt="" />
    </span>
    <div className="item-text item-text--duplicate">
      <span className="item-warning">{duplicateWarningLabel}</span>
    </div>
  </button>
));

DuplicatePreviewCard.displayName = "DuplicatePreviewCard";

const AddItemDialog = ({
  isOpen,
  itemName,
  suggestions,
  duplicatePreview,
  onItemNameChange,
  onClose,
  onAddItem,
  onAddSuggestion,
}: AddItemDialogProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { locale, t } = useI18n();
  const duplicateWarningLabel = t("addItem.duplicateWarning");
  const duplicateAriaLabel = useMemo(
    () => (duplicatePreview ? `${duplicatePreview.name}. ${duplicateWarningLabel}` : ""),
    [duplicatePreview, duplicateWarningLabel],
  );

  useEffect(() => {
    if (!isOpen) {return;}
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) {return null;}

  return (
    <div className="modal-backdrop add-dialog" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <form
          className="add-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void onAddItem();
          }}
        >
          <input
            ref={inputRef}
            value={itemName}
            onChange={(event) => onItemNameChange(event.target.value)}
            placeholder={t("addItem.placeholder")}
            aria-label={t("addItem.itemName")}
          />
        </form>
        <div className="modal__grid">
          {duplicatePreview ? (
            <DuplicatePreviewCard
              name={duplicatePreview.name}
              quantityOrUnit={duplicatePreview.quantityOrUnit}
              locale={locale}
              duplicateWarningLabel={duplicateWarningLabel}
              duplicateAriaLabel={duplicateAriaLabel}
              onAddSuggestion={onAddSuggestion}
            />
          ) : null}
          {suggestions.map((name) => {
            const parsed = parseItemInput(name, locale);
            const displayName = parsed.name || name;
            return (
              <button
                key={name}
                type="button"
                className="item-card item-card--dialog"
                onClick={() => {
                  if (!parsed.name) {return;}
                  void onAddSuggestion(parsed.name, parsed.quantityOrUnit);
                }}
              >
                <span className="item-icon" aria-hidden="true">
                  <img src={getItemIcon(displayName, locale)} alt="" />
                </span>
                <div className="item-text">
                  <span className="item-name">{displayName}</span>
                  {parsed.quantityOrUnit && (
                    <span className="item-quantity">{parsed.quantityOrUnit}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AddItemDialog;
