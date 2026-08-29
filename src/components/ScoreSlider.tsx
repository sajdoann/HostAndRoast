import { SCORE_MAX, SCORE_MIN } from "../domain/categories";

/** A labelled 1–10 score slider. */
export default function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="score-row">
      <div className="score-head">
        <span className="score-label">{label}</span>
        <span className="score-value">{value}</span>
      </div>
      <input
        type="range"
        min={SCORE_MIN}
        max={SCORE_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
