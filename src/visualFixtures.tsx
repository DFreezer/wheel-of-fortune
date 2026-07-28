import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Wheel, type WheelItem } from './lib';
import './visualFixtures.css';

const image = new URL('./assets/realistic-space/galaxy.webp', import.meta.url).href;
const palette = ['#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2'];

const baseItems: WheelItem[] = palette.map((color, index) => ({ id: `fixture-${index}`, label: `Prize ${index + 1}`, weight: index + 1, color }));
const denseItems: WheelItem[] = Array.from({ length: 100 }, (_, index) => ({ id: `dense-${index}`, label: `Prize ${index + 1}`, weight: 1 + ((index * 3) % 5), color: palette[index % palette.length] }));

function Fixture({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="visualFixture"><h2>{title}</h2>{children}</section>;
}

function CollapseFixture() {
  const [expanded, setExpanded] = useState(false);
  const items = useMemo(() => expanded ? [...baseItems, { id: 'fixture-extra', label: 'New prize', weight: 3, color: '#0f766e' }] : baseItems, [expanded]);
  return <Fixture title="Full Canvas collapse (1–50)">
    <Wheel items={items} size={260} itemsTransition={{ mode: 'collapse', duration: 500 }} />
    <button onClick={() => setExpanded((value) => !value)}>Toggle item</button>
  </Fixture>;
}

function Fixtures() {
  const [highlighted, setHighlighted] = useState<string>();
  return <main className="visualFixtures">
    <header><p>Canvas fixtures</p><h1>Visual regression reference</h1><a href="/">Return to playground</a></header>
    <div className="visualFixtures__grid">
      <Fixture title="Palette, border and dividers"><Wheel items={baseItems} size={260} theme={{ border: { color: '#fef3c7', width: 1.1, shadow: { color: '#f59e0b', blur: 1.2 } }, dividers: { color: '#0f172a', width: .7, shadow: { color: '#000000', blur: 1 } } }} /></Fixture>
      <Fixture title="Text orientations, stroke and shadow"><Wheel items={baseItems.map((item, index) => ({ ...item, text: { orientation: (['horizontal', 'radial', 'tangential'] as const)[index % 3], fontSize: 3.7, strokeColor: '#312e81', strokeWidth: .35, shadow: { color: '#020617', blur: .7, offsetX: .25, offsetY: .25 } } }))} size={260} /></Fixture>
      <Fixture title="Image fit, transform and opacity"><Wheel items={baseItems.map((item, index) => ({ ...item, image: { src: image, fit: (['cover', 'contain', 'stretch'] as const)[index % 3], opacity: .18 + index * .1, scale: .85 + index * .06, rotation: index * 12, offsetX: index - 2, offsetY: 2 - index } }))} size={260} /></Fixture>
      <Fixture title="Controlled highlight layer"><Wheel items={baseItems} size={260} highlightedItemId={highlighted} highlightStyle={{ color: '#fef08a', opacity: .3, blendMode: 'screen' }} onSectorHover={(sector) => setHighlighted(sector?.item.id)} /></Fixture>
      <CollapseFixture />
      <Fixture title="Dense 100-sector LOD"><Wheel items={denseItems} size={260} minLabelAngle={8} accessibleItemList={false} /></Fixture>
    </div>
  </main>;
}

interface FixturesRootElement extends HTMLElement {
  __wheelOfFortuneFixturesRoot?: ReturnType<typeof createRoot>;
}

const rootElement = document.getElementById('root')! as FixturesRootElement;
const root = rootElement.__wheelOfFortuneFixturesRoot ?? (rootElement.__wheelOfFortuneFixturesRoot = createRoot(rootElement));
root.render(<Fixtures />);
