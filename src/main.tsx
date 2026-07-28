import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Playground } from './playground';

interface WheelRootElement extends HTMLElement {
  __wheelOfFortuneRoot?: ReturnType<typeof createRoot>;
}

const rootElement = document.getElementById('root')! as WheelRootElement;
const root = rootElement.__wheelOfFortuneRoot ?? (rootElement.__wheelOfFortuneRoot = createRoot(rootElement));

root.render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
