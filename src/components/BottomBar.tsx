type BottomBarProps = {
  onOpenDrawer: () => void;
  onAddItem: () => void;
};

const BottomBar = ({ onOpenDrawer, onAddItem }: BottomBarProps) => {
  return (
    <div className="bottom-bar" role="toolbar" aria-label="List actions">
      <div className="bottom-bar__inner">
        <button type="button" className="bottom-bar__icon-button" aria-label="Open list menu" onClick={onOpenDrawer}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
              fill="currentColor"
            />
          </svg>
        </button>

        <button type="button" className="bottom-bar__fab" aria-label="Add item" onClick={onAddItem}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
          </svg>
        </button>

        <span className="bottom-bar__spacer" aria-hidden="true" />

        <button type="button" className="bottom-bar__icon-button" aria-label="Share list">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a2.5 2.5 0 0 0 0-1.39l7-4.11A3 3 0 1 0 15 5a3.02 3.02 0 0 0 .04.48l-7 4.12a3 3 0 1 0 0 4.8l7.13 4.18A3 3 0 1 0 18 16.08z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BottomBar;
