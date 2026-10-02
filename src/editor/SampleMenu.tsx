import { SAMPLES, type Sample } from '../samples/samples'
import './editor.css'

export function SampleList({ onPick }: { onPick: (s: Sample) => void }) {
  return (
    <ul className="tl-samples">
      {SAMPLES.map((s) => (
        <li key={s.id}>
          <button type="button" onClick={() => onPick(s)}>
            <b>{s.title}</b>
            <span>{s.description}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
