type ThemeEntry = {
  id: string;
  label: string;
};

type ThemeSwitcherProps = {
  themes: ThemeEntry[];
  activeTheme: string;
  onChange: (themeId: string) => void;
};

export default function ThemeSwitcher({ themes, activeTheme, onChange }: ThemeSwitcherProps) {
  return (
    <div className="theme-switcher">
      {themes.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`theme-chip${activeTheme === entry.id ? " active" : ""}`}
          onClick={() => onChange(entry.id)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

