type AppHeaderProps = {
  activeListName: string;
  onEditListName: () => void;
};

const AppHeader = ({ activeListName, onEditListName }: AppHeaderProps) => {
  return (
    <header className="app__header">
      <div className="title-row">
        <h1>{activeListName}</h1>
        <button
          type="button"
          className="icon-button"
          onClick={onEditListName}
          aria-label="Edit list name"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.5c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
