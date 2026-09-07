import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export function EditorFocusModeControl() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('flockdoc-focus-mode', active);
    if (!active) return;

    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', exitOnEscape);
    return () => {
      window.removeEventListener('keydown', exitOnEscape);
      document.body.classList.remove('flockdoc-focus-mode');
    };
  }, [active]);

  return active
    ? <button className="focus-mode-exit" type="button" onClick={() => setActive(false)}>
        <Minimize2 /> Back to Flockfly
      </button>
    : <button className="focus-mode-enter" type="button" onClick={() => setActive(true)} aria-label="Enter full screen">
        <Maximize2 /> <span>Full screen</span>
      </button>;
}
