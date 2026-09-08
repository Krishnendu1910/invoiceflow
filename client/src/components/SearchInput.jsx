import { useEffect, useRef, useState } from "react";

// Debounces keystrokes before calling onChange, so a list page doesn't fire
// an API request on every character. Syncing `text` from an external `value`
// change is done during render (comparing against `lastValue`) rather than
// in an effect, per https://react.dev/learn/you-might-not-need-an-effect.
export default function SearchInput({ value, onChange, placeholder = "Search...", delay = 300 }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (text !== value) {
        onChangeRef.current(text);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [text, delay, value]);

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
    />
  );
}
