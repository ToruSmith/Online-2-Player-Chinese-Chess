interface ChoiceProps<T extends string> {
  legend: string;
  value: T;
  options: readonly { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
}

/** 單選群組，手機上也有足夠大的點擊範圍。 */
export function Choice<T extends string>({ legend, value, options, onChange }: ChoiceProps<T>) {
  return (
    <fieldset className="choice">
      <legend className="choice__legend">{legend}</legend>
      <div className="choice__options">
        {options.map((option) => (
          <label key={option.value} className="choice__option">
            <input
              type="radio"
              name={legend}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="choice__face">
              <span className="choice__label">{option.label}</span>
              {option.description && (
                <span className="choice__description">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
