import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  Wheel,
  WheelMedia,
  useWheel,
  type IdleAnimationConfig,
  type ItemsTransitionConfig,
  type SectorTextStyle,
  type SpinAnimationConfig,
  type WheelItem,
  type WheelPointerPosition,
  type WheelRenderer,
  type WheelSectorImage,
  type WheelSoundConfig,
  type WheelThemeOptions,
} from './lib';
import './app.css';

const realisticSpaceAssets = {
  beep: new URL('./assets/realistic-space/beep.mp3', import.meta.url).href,
  earth: new URL('./assets/realistic-space/earth.webp', import.meta.url).href,
  galaxy: new URL('./assets/realistic-space/galaxy.webp', import.meta.url).href,
  mars: new URL('./assets/realistic-space/mars.webp', import.meta.url).href,
  saturn: new URL('./assets/realistic-space/saturn.webp', import.meta.url).href,
  spacecraft: new URL('./assets/realistic-space/spacecraft.webp', import.meta.url).href,
  sun: new URL('./assets/realistic-space/sun.webp', import.meta.url).href,
};

const palette = ['#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#be123c'];

const defaultSectorImage: WheelSectorImage = {
  src: realisticSpaceAssets.galaxy,
  opacity: 0.24,
  fit: 'cover',
};

const initialItems: WheelItem[] = [
  { id: 'gift', label: 'Gift', weight: 18, color: '#7c3aed', image: defaultSectorImage },
  { id: 'bonus', label: 'Bonus ×2', weight: 12, color: '#db2777', image: defaultSectorImage },
  { id: 'try-again', label: 'Try again', weight: 25, color: '#ea580c', image: defaultSectorImage },
  { id: 'free-shipping', label: 'Free shipping', weight: 15, color: '#ca8a04', image: defaultSectorImage },
  { id: 'coupon', label: '15% discount', weight: 20, color: '#16a34a', image: defaultSectorImage },
  { id: 'jackpot', label: 'Jackpot', weight: 10, color: '#0891b2', image: defaultSectorImage, text: { fontSize: 3.9 } },
];

const localizedSeedLabels = {
  gift: { en: 'Gift', uk: 'Подарунок' },
  bonus: { en: 'Bonus ×2', uk: 'Бонус ×2' },
  'try-again': { en: 'Try again', uk: 'Ще раз' },
  'free-shipping': { en: 'Free shipping', uk: 'Безкоштовна доставка' },
  coupon: { en: '15% discount', uk: 'Знижка 15%' },
  jackpot: { en: 'Jackpot', uk: 'Джекпот' },
} as const;

const spinPresetAnimations = {
  smooth: { rotations: { min: 5, max: 7 }, easing: 'cubic-bezier(0.12, 0.82, 0.18, 1)' },
  snappy: { rotations: { min: 4, max: 5 }, easing: 'cubic-bezier(0.16, 0.92, 0.22, 1)' },
  dramatic: { rotations: { min: 8, max: 10 }, easing: 'cubic-bezier(0.08, 0.91, 0.18, 1)' },
  bounce: { rotations: { min: 5, max: 6 }, easing: 'cubic-bezier(0.16, 1.12, 0.34, 1)' },
} as const satisfies Record<string, Omit<SpinAnimationConfig, 'duration'>>;

const npmInstallCommand = 'npm install @cxde/wheel-of-fortune';

type SpinPreset = keyof typeof spinPresetAnimations;
type FrameMode = 'classic' | 'neon' | 'cosmic' | 'realistic-space' | 'custom' | 'none';
type CenterMode = 'cap' | 'gem' | 'neon' | 'cosmic' | 'realistic-space' | 'custom' | 'none';
type PointerMode = 'default' | 'neon' | 'cosmic' | 'realistic-space';
type SettingsPanel = 'spin' | 'sectors' | 'appearance' | 'effects';
type Locale = 'en' | 'uk';

const settingsPanelIds: SettingsPanel[] = ['spin', 'sectors', 'appearance', 'effects'];

const translations = {
  en: {
    language: { label: 'Language', english: 'English', ukrainian: 'Ukrainian' },
    items: { gift: 'Gift', bonus: 'Bonus ×2', tryAgain: 'Try again', freeShipping: 'Free shipping', coupon: '15% discount', jackpot: 'Jackpot', prize: 'Prize' },
    presets: {
      smooth: { label: 'Smooth', description: 'Gentle start and long deceleration' },
      snappy: { label: 'Snappy', description: 'Fast acceleration and confident stop' },
      dramatic: { label: 'Dramatic', description: 'More rotations and a long suspense' },
      bounce: { label: 'Soft bounce', description: 'The curve slightly overshoots the final point' },
    },
    panels: {
      spin: { label: 'Spin', description: 'Winner, landing and spin animation' },
      sectors: { label: 'Sectors', description: 'Wheel contents and per-prize settings' },
      appearance: { label: 'Appearance', description: 'Size, frame, center, colors and typography' },
      effects: { label: 'Effects', description: 'Idle animation and sound' },
    },
    itemEditor: { color: 'Sector color', name: 'Sector name', weight: 'weight', configure: 'Configure text for', configureTitle: 'Configure sector', remove: 'Remove', untitled: 'untitled sector' },
    media: { file: 'File', placeholder: 'https://… / GIF / WebM', soundPlaceholder: 'URL (optional)', remove: 'Remove', customFrame: 'Custom frame', centerImage: 'Center image' },
    hero: {
      badge: 'Production-ready React component',
      title: 'The wheel that',
      titleHighlight: 'earns attention.',
      copy: 'A deeply customizable prize wheel for React. Smooth on high-refresh displays, deterministic when your server decides the winner, and expressive down to every sector.',
      openPlayground: 'Open playground',
      copyInstall: 'Copy install',
      copied: 'Copied!',
      compositor: 'One animated<br />compositor layer',
    },
    landing: {
      navQuickStart: 'Quick start',
      navPlayground: 'Playground',
      version: 'v0.1.0',
      quickStart: 'Quick start',
      quickIntro: 'Install, import, spin. Everything else is optional.',
      installStep: 'Install package',
      useStep: 'Render your first wheel',
      codeFile: 'quick-start.tsx',
      instruction: 'Pass a controlled items array. Use the controller only when you need to start or cancel spins imperatively.',
      labEyebrow: 'Interactive lab',
      labTitle: 'Tune every detail. See every change.',
      labCopy: 'Switch renderers, edit sectors, upload media and sounds, then test client- or server-controlled outcomes without leaving the page.',
      features: [
        { value: '60+', label: 'high-refresh FPS' },
        { value: '1–1000+', label: 'weighted sectors' },
        { value: 'SVG / Canvas', label: 'adaptive rendering' },
        { value: 'Client / Server', label: 'winner control' },
      ],
    },
    settings: { title: 'Wheel settings', groups: 'Settings groups' },
    stage: { preview: 'Wheel preview', result: 'Result', lastTick: 'Last tick', underCursor: 'Under cursor', sectors: (count: number) => `${count} sectors`, weight: 'weight' },
    spin: { title: 'Spin', spinning: 'Wheel is spinning…', random: 'Spin randomly', server: 'Spin with server result', cancel: 'Cancel spin / request', serverWinner: 'Server winner', landing: 'Landing position', center: 'Sector center', randomInside: 'Random inside', preset: 'Spin preset', rotations: 'rotations', duration: 'Duration', seconds: 's', async: 'Resolve winner through async resolver (1.2s demo)' },
    appearance: { title: 'Appearance, frame and center', rendering: 'Rendering', auto: 'Auto: Canvas from 300', svg: 'SVG: maximum customization', canvas: 'Canvas: dense wheel', size: 'Size inside container', frame: 'Frame', center: 'Center', classic: 'Classic SVG', neon: 'Animated neon SVG', cosmic: 'Cosmic orbits SVG', realistic: 'Realistic space', custom: 'Custom media', none: 'No frame', cap: 'SPIN cap', gem: 'Gem', miniSolar: 'Mini solar system', realisticSolar: 'Realistic solar system', noCenter: 'No center', frameMedia: 'Frame: URL, GIF or WebM', centerMedia: 'Center: URL, GIF or WebM', centerSize: 'Center size', pointerPosition: 'Pointer position', top: 'Top', right: 'Right', pointer: 'Pointer', defaultPointer: 'Default', cosmicPointer: 'Spacecraft', realisticPointer: 'Realistic spacecraft' },
    theme: { title: 'Global theme and text', reset: 'Reset', colors: 'Colors, borders and dividers', wheelBackground: 'Wheel background', text: 'Text', color: 'Color', border: 'Border', dividers: 'Dividers', dividerShadow: 'Divider shadow', blur: 'Blur', offsetX: 'Offset X', offsetY: 'Offset Y', typography: 'Typography and positioning', font: 'Font', orientation: 'Orientation', tangential: 'Tangential', radial: 'Radial', horizontal: 'Horizontal', align: 'Alignment', middle: 'Center', start: 'Start', end: 'End', overflow: 'Overflow', hide: 'Hide', ellipsis: 'Ellipsis', shrink: 'Shrink', sizeShort: 'Size', weightShort: 'Weight', radius: 'Radius', textEffects: 'Text stroke and shadow', textStroke: 'Text stroke', shadow: 'Text shadow', thickness: 'Thickness', shadowX: 'Shadow X', shadowY: 'Shadow Y' },
    sectors: { addRemove: 'Add and remove', transition: 'List change animation', collapse: 'Collapse / expand sectors', noAnimation: 'No animation', transitionHint: 'In SVG, neighboring sector boundaries smoothly meet on removal and spread on addition. Dense Canvas wheels use a fast crossfade.', duration: 'Duration', title: 'Sectors', add: '+ Add', restore: 'Restore demo', loadTest: 'Load test set', hidden: (count: number) => `The editor is hidden for ${count} sectors so the playground does not distort wheel performance.`, empty: 'Add at least one sector.', textTitle: 'Text', resetOverride: 'Reset override', imageSection: 'Sector image', added: 'Added', notSet: 'Not set', imageOverColor: 'Image over color', opacity: 'Opacity', scale: 'Scale', rotation: 'Rotation', imageOffsetX: 'Offset X', imageOffsetY: 'Offset Y', fit: 'Fit', stretch: 'Stretch', removeImage: 'Remove image', sectorText: 'Sector text', color: 'Color' },
    effects: { idle: 'Idle animation', idleAria: 'Enable idle animation', idleLead: 'A subtle motion keeps the wheel alive between spins.', period: 'Period', rotation: 'Rotation', pulse: 'Pulse', sound: 'Sound', start: 'Start', sectorPass: 'Sector pass', win: 'Win' },
    errors: { initial: 'Choose a mode and spin the wheel', selectedServer: (label: string) => `Sector “${label}” selected for server-side mode`, denseLoaded: (count: number) => `Loaded ${count} sectors for renderer testing`, winner: (label: string, mode: string) => `${label} · ${mode === 'server' ? 'server-side' : 'client-side'}` },
  },
  uk: {
    language: { label: 'Мова', english: 'English', ukrainian: 'Українська' },
    items: { gift: 'Подарунок', bonus: 'Бонус ×2', tryAgain: 'Ще раз', freeShipping: 'Безкоштовна доставка', coupon: 'Знижка 15%', jackpot: 'Джекпот', prize: 'Приз' },
    presets: {
      smooth: { label: 'Плавна', description: 'М’який старт і довге гальмування' },
      snappy: { label: 'Різка', description: 'Швидкий розгін і впевнена зупинка' },
      dramatic: { label: 'Драматична', description: 'Більше обертів і довга напруга' },
      bounce: { label: 'Легкий відскок', description: 'Крива трохи перелітає кінцеву точку' },
    },
    panels: {
      spin: { label: 'Прокрутка', description: 'Переможець, позиція зупинки та анімація' },
      sectors: { label: 'Сектори', description: 'Склад колеса та налаштування окремих призів' },
      appearance: { label: 'Вигляд', description: 'Розмір, рамка, центр, кольори та типографіка' },
      effects: { label: 'Ефекти', description: 'Idle-анімація та звук' },
    },
    itemEditor: { color: 'Колір сектора', name: 'Назва сектора', weight: 'вага', configure: 'Налаштувати текст для', configureTitle: 'Налаштувати сектор', remove: 'Видалити', untitled: 'сектор без назви' },
    media: { file: 'Файл', placeholder: 'https://… / GIF / WebM', soundPlaceholder: 'URL (необов’язково)', remove: 'Прибрати', customFrame: 'Власна рамка', centerImage: 'Центральне зображення' },
    hero: {
      badge: 'Готовий до production React-компонент',
      title: 'Колесо, яке',
      titleHighlight: 'привертає увагу.',
      copy: 'Глибоко кастомізоване колесо призів для React. Плавне на високочастотних дисплеях, передбачуване, коли переможця визначає сервер, і виразне до найменшого сектора.',
      openPlayground: 'Відкрити playground',
      copyInstall: 'Копіювати команду',
      copied: 'Скопійовано!',
      compositor: 'Один анімований<br />compositor-шар',
    },
    landing: {
      navQuickStart: 'Швидкий старт',
      navPlayground: 'Playground',
      version: 'v0.1.0',
      quickStart: 'Швидкий старт',
      quickIntro: 'Встановіть, імпортуйте, обертайте. Решта — за потреби.',
      installStep: 'Встановіть пакет',
      useStep: 'Створіть перше колесо',
      codeFile: 'quick-start.tsx',
      instruction: 'Передайте керований масив items. Controller потрібен лише для імперативного запуску або скасування обертання.',
      labEyebrow: 'Інтерактивна лабораторія',
      labTitle: 'Налаштовуйте кожну деталь. Одразу бачте результат.',
      labCopy: 'Перемикайте renderer, редагуйте сектори, завантажуйте медіа та звуки й тестуйте client- або server-controlled результат на одній сторінці.',
      features: [
        { value: '60+', label: 'FPS на швидких дисплеях' },
        { value: '1–1000+', label: 'зважених секторів' },
        { value: 'SVG / Canvas', label: 'адаптивний рендеринг' },
        { value: 'Client / Server', label: 'контроль переможця' },
      ],
    },
    settings: { title: 'Налаштування колеса', groups: 'Групи налаштувань' },
    stage: { preview: 'Попередній перегляд колеса', result: 'Результат', lastTick: 'Останній tick', underCursor: 'Під курсором', sectors: (count: number) => `${count} секторів`, weight: 'вага' },
    spin: { title: 'Прокрутка', spinning: 'Колесо обертається…', random: 'Крутити випадково', server: 'Крутити з результатом сервера', cancel: 'Скасувати прокрутку / запит', serverWinner: 'Переможець від сервера', landing: 'Позиція зупинки', center: 'Центр сектора', randomInside: 'Випадково всередині', preset: 'Пресет обертання', rotations: 'обертів', duration: 'Тривалість', seconds: 'с', async: 'Отримувати winner через async resolver (демо 1,2 с)' },
    appearance: { title: 'Вигляд, рамка та центр', rendering: 'Рендеринг', auto: 'Auto: Canvas від 300', svg: 'SVG: максимум кастомізації', canvas: 'Canvas: щільне колесо', size: 'Розмір у контейнері', frame: 'Рамка', center: 'Центр', classic: 'Класична SVG', neon: 'Анімований неон SVG', cosmic: 'Космічні орбіти SVG', realistic: 'Реалістичний космос', custom: 'Власне медіа', none: 'Без рамки', cap: 'SPIN cap', gem: 'Кристал', miniSolar: 'Міні-сонячна система', realisticSolar: 'Реалістична сонячна система', noCenter: 'Без центра', frameMedia: 'Рамка: URL, GIF або WebM', centerMedia: 'Центр: URL, GIF або WebM', centerSize: 'Розмір центра', pointerPosition: 'Положення вказівника', top: 'Зверху', right: 'Праворуч', pointer: 'Вказівник', defaultPointer: 'Стандартний', cosmicPointer: 'Космічний апарат', realisticPointer: 'Реалістичний апарат' },
    theme: { title: 'Загальна тема та текст', reset: 'Скинути', colors: 'Кольори, межі та роздільники', wheelBackground: 'Фон колеса', text: 'Текст', color: 'Колір', border: 'Обводка', dividers: 'Роздільники', dividerShadow: 'Тінь роздільників', blur: 'Розмиття', offsetX: 'Зсув X', offsetY: 'Зсув Y', typography: 'Типографіка та позиціонування', font: 'Шрифт', orientation: 'Орієнтація', tangential: 'По дотичній', radial: 'По радіусу', horizontal: 'Горизонтально', align: 'Вирівнювання', middle: 'По центру', start: 'На початку', end: 'У кінці', overflow: 'Переповнення', hide: 'Приховати', ellipsis: 'Многоточчя', shrink: 'Зменшити', sizeShort: 'Розмір', weightShort: 'Товщина', radius: 'Радіус', textEffects: 'Обводка й тінь тексту', textStroke: 'Обводка тексту', shadow: 'Тінь тексту', thickness: 'Товщина', shadowX: 'Тінь X', shadowY: 'Тінь Y' },
    sectors: { addRemove: 'Додавання та видалення', transition: 'Анімація зміни списку', collapse: 'Схлопування / розкриття секторів', noAnimation: 'Без анімації', transitionHint: 'У SVG межі сусідніх секторів плавно сходяться під час видалення та розходяться під час додавання. Для щільного Canvas-колеса використовується швидкий crossfade.', duration: 'Тривалість', title: 'Сектори', add: '+ Додати', restore: 'Відновити демо', loadTest: 'Навантажувальний набір', hidden: (count: number) => `Редактор приховано для ${count} секторів, щоб playground не спотворював продуктивність колеса.`, empty: 'Додайте хоча б один сектор.', textTitle: 'Текст', resetOverride: 'Скинути override', imageSection: 'Зображення сектора', added: 'Додано', notSet: 'Не задано', imageOverColor: 'Зображення поверх кольору', opacity: 'Непрозорість', scale: 'Масштаб', rotation: 'Поворот', imageOffsetX: 'Зсув X', imageOffsetY: 'Зсув Y', fit: 'Заповнення', stretch: 'Розтягнути', removeImage: 'Прибрати зображення', sectorText: 'Текст сектора', color: 'Колір' },
    effects: { idle: 'Idle-анімація', idleAria: 'Увімкнути idle-анімацію', idleLead: 'Легкий рух оживляє колесо між прокрутками.', period: 'Період', rotation: 'Поворот', pulse: 'Пульсація', sound: 'Звук', start: 'Старт', sectorPass: 'Проходження сектора', win: 'Виграш' },
    errors: { initial: 'Оберіть режим і запустіть колесо', selectedServer: (label: string) => `Сектор «${label}» вибрано для server-side режиму`, denseLoaded: (count: number) => `Завантажено ${count} секторів для перевірки renderer`, winner: (label: string, mode: string) => `${label} · ${mode === 'server' ? 'server-side' : 'client-side'}` },
  },
} as const;

type LocaleCopy = (typeof translations)[Locale];

interface ThemeSettings {
  background: string;
  borderColor: string;
  borderWidth: number;
  dividerColor: string;
  dividerWidth: number;
  dividerShadowColor: string;
  dividerShadowBlur: number;
  dividerShadowX: number;
  dividerShadowY: number;
  textColor: string;
  textStrokeColor: string;
  textStrokeWidth: number;
  textShadowColor: string;
  textShadowBlur: number;
  textShadowX: number;
  textShadowY: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textRadius: number;
  textOffsetX: number;
  textOffsetY: number;
  orientation: SectorTextStyle['orientation'];
  align: SectorTextStyle['align'];
  overflow: SectorTextStyle['overflow'];
}

const defaultThemeSettings: ThemeSettings = {
  background: '#172033',
  borderColor: '#f8fafc',
  borderWidth: 0.85,
  dividerColor: '#000000',
  dividerWidth: 0.45,
  dividerShadowColor: '#000000',
  dividerShadowBlur: 1,
  dividerShadowX: 0,
  dividerShadowY: 0,
  textColor: '#ffffff',
  textStrokeColor: '#1e1b4b',
  textStrokeWidth: 0,
  textShadowColor: '#020617',
  textShadowBlur: 0,
  textShadowX: 0,
  textShadowY: 0,
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: 3.35,
  fontWeight: 700,
  textRadius: 0.68,
  textOffsetX: 0,
  textOffsetY: 0,
  orientation: 'radial',
  align: 'middle',
  overflow: 'ellipsis',
};

let nextItem = 1;

function waitForServer(signal: AbortSignal, delay = 1200): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Server request aborted', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

function FrameOverlay() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48.6" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="45.7" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth=".6" strokeDasharray="1 1.8" />
    </svg>
  );
}

function NeonFrameOverlay() {
  const instanceId = useId().replace(/:/g, '');
  const gradientId = `${instanceId}-neon-stroke`;
  const glowId = `${instanceId}-neon-glow`;
  const particleGlowId = `${instanceId}-particle-glow`;
  const particles = [
    { angle: 0, duration: 5.8, delay: -2.1, size: .72, color: '#67e8f9' },
    { angle: 52, duration: 8.4, delay: -5.7, size: .46, color: '#f0abfc' },
    { angle: 105, duration: 6.9, delay: -3.8, size: .58, color: '#c4b5fd' },
    { angle: 162, duration: 10.2, delay: -7.6, size: .38, color: '#22d3ee' },
    { angle: 218, duration: 7.6, delay: -1.4, size: .65, color: '#f9a8d4' },
    { angle: 273, duration: 9.3, delay: -6.2, size: .42, color: '#a5f3fc' },
    { angle: 326, duration: 6.4, delay: -4.9, size: .54, color: '#ddd6fe' },
  ];

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="neonFrame">
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.35" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={particleGlowId} x="-400%" y="-400%" width="900%" height="900%">
          <feGaussianBlur stdDeviation=".7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="8" x2="92" y1="12" y2="88">
          <stop stopColor="#f0abfc" />
          <stop offset=".24" stopColor="#8b5cf6" />
          <stop offset=".5" stopColor="#67e8f9" />
          <stop offset=".76" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#f9a8d4" />
        </linearGradient>
      </defs>
      <g className="neonFrame__colorCycle">
        <circle className="neonFrame__aura" cx="50" cy="50" r="48.1" fill="none" stroke={`url(#${gradientId})`} strokeWidth="3.1" opacity=".26" filter={`url(#${glowId})`} />
        <circle className="neonFrame__mainRing" cx="50" cy="50" r="48" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.55" filter={`url(#${glowId})`} />
        <circle className="neonFrame__runner" cx="50" cy="50" r="46.35" fill="none" stroke="#f0f9ff" strokeWidth=".58" filter={`url(#${glowId})`} />
        <circle className="neonFrame__runner neonFrame__runner--reverse" cx="50" cy="50" r="44.75" fill="none" stroke="#c4b5fd" strokeWidth=".34" />
      </g>
      <circle className="neonFrame__innerRing" cx="50" cy="50" r="43.8" fill="none" stroke="#e0f2fe" strokeOpacity=".44" strokeWidth=".28" strokeDasharray=".65 1.8" />
      <g className="neonFrame__particles">
        {particles.map((particle, index) => (
          <g
            key={index}
            className="neonFrame__particleOrbit"
            style={{
              '--particle-angle': `${particle.angle}deg`,
              '--particle-duration': `${particle.duration}s`,
              '--particle-delay': `${particle.delay}s`,
            } as CSSProperties}
          >
            <ellipse className="neonFrame__particleTrail" cx="50" cy="1.75" rx={particle.size * 2.6} ry={particle.size * .36} fill={particle.color} filter={`url(#${particleGlowId})`} />
            <circle className="neonFrame__particle" cx="50" cy="1.75" r={particle.size} fill={particle.color} filter={`url(#${particleGlowId})`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function CosmicFrameOverlay() {
  const instanceId = useId().replace(/:/g, '');
  const ringGradientId = `${instanceId}-cosmic-ring`;
  const glowId = `${instanceId}-cosmic-glow`;
  const planets = [
    { angle: 8, radius: 49, duration: 15, delay: -4.2, size: 2.15, color: '#60a5fa', ring: true },
    { angle: 78, radius: 46.8, duration: 22, delay: -14.7, size: 1.25, color: '#fb7185', ring: false },
    { angle: 153, radius: 49.5, duration: 31, delay: -20.3, size: 2.7, color: '#fbbf24', ring: true },
    { angle: 229, radius: 47.8, duration: 18, delay: -8.6, size: 1.55, color: '#a78bfa', ring: false },
    { angle: 312, radius: 50.2, duration: 26, delay: -17.1, size: 1.9, color: '#34d399', ring: true },
  ];
  const stars = [
    { x: 18, y: 10, size: .35, delay: -.4 }, { x: 34, y: 4.5, size: .25, delay: -1.8 },
    { x: 67, y: 5.5, size: .4, delay: -2.5 }, { x: 84, y: 15, size: .28, delay: -.9 },
    { x: 94, y: 35, size: .32, delay: -1.3 }, { x: 96, y: 69, size: .22, delay: -2.9 },
    { x: 82, y: 89, size: .38, delay: -2.1 }, { x: 63, y: 96, size: .26, delay: -.2 },
    { x: 36, y: 95, size: .34, delay: -1.5 }, { x: 13, y: 84, size: .24, delay: -2.7 },
    { x: 4.5, y: 62, size: .36, delay: -1.1 }, { x: 7, y: 31, size: .23, delay: -2.2 },
  ];

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="cosmicFrame">
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.15" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={ringGradientId} gradientUnits="userSpaceOnUse" x1="7" x2="93" y1="14" y2="86">
          <stop stopColor="#38bdf8" />
          <stop offset=".28" stopColor="#818cf8" />
          <stop offset=".56" stopColor="#f0abfc" />
          <stop offset=".78" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle className="cosmicFrame__nebula" cx="50" cy="50" r="48.1" fill="none" stroke={`url(#${ringGradientId})`} strokeWidth="4.5" opacity=".22" filter={`url(#${glowId})`} />
      <circle className="cosmicFrame__rim" cx="50" cy="50" r="48" fill="none" stroke={`url(#${ringGradientId})`} strokeWidth="1.15" filter={`url(#${glowId})`} />
      <circle className="cosmicFrame__orbitTrack" cx="50" cy="50" r="45.5" fill="none" stroke="#bae6fd" strokeOpacity=".42" strokeWidth=".28" strokeDasharray="1.1 2.2" />
      <circle className="cosmicFrame__orbitTrack cosmicFrame__orbitTrack--outer" cx="50" cy="50" r="49.7" fill="none" stroke="#ddd6fe" strokeOpacity=".3" strokeWidth=".22" strokeDasharray=".5 2.8" />
      <g className="cosmicFrame__starfield">
        {stars.map((star, index) => (
          <circle
            key={index}
            className="cosmicFrame__star"
            cx={star.x}
            cy={star.y}
            r={star.size}
            fill="#f8fafc"
            style={{ '--star-delay': `${star.delay}s` } as CSSProperties}
          />
        ))}
      </g>
      {planets.map((planet, index) => {
        const y = 50 - planet.radius;
        return (
          <g
            key={index}
            className="cosmicFrame__planetOrbit"
            style={{
              '--planet-angle': `${planet.angle}deg`,
              '--planet-duration': `${planet.duration}s`,
              '--planet-delay': `${planet.delay}s`,
            } as CSSProperties}
          >
            {planet.ring && <ellipse cx="50" cy={y} rx={planet.size * 1.85} ry={planet.size * .5} fill="none" stroke="#fef3c7" strokeOpacity=".78" strokeWidth=".42" />}
            <circle className="cosmicFrame__planet" cx="50" cy={y} r={planet.size} fill={planet.color} filter={`url(#${glowId})`} />
            <circle cx={50 - planet.size * .34} cy={y - planet.size * .34} r={planet.size * .28} fill="#fff" opacity=".55" />
          </g>
        );
      })}
      <g className="cosmicFrame__cometOrbit">
        <ellipse className="cosmicFrame__cometTrail" cx="50" cy="1" rx="5.8" ry=".52" fill="#67e8f9" opacity=".34" filter={`url(#${glowId})`} />
        <circle cx="50" cy="1" r=".85" fill="#fff" filter={`url(#${glowId})`} />
      </g>
    </svg>
  );
}

function RealisticSpaceFrameOverlay() {
  const instanceId = useId().replace(/:/g, '');
  const metalId = `${instanceId}-realistic-space-metal`;
  const planets = [
    { src: realisticSpaceAssets.earth, label: 'Earth', angle: 12, radius: 49.2, duration: 24, delay: -4.2, size: 12 },
    { src: realisticSpaceAssets.mars, label: 'Mars', angle: 104, radius: 47.4, duration: 34, delay: -17.5, size: 9.5 },
    { src: realisticSpaceAssets.saturn, label: 'Saturn', angle: 202, radius: 49.5, duration: 46, delay: -31.8, size: 18 },
    { src: realisticSpaceAssets.sun, label: 'Sun', angle: 296, radius: 48.2, duration: 57, delay: -22.4, size: 11.5 },
  ];
  const stars = [
    { x: 12, y: 19, size: .25, delay: -.4 }, { x: 27, y: 5, size: .18, delay: -1.7 },
    { x: 72, y: 5, size: .28, delay: -2.4 }, { x: 91, y: 23, size: .2, delay: -.8 },
    { x: 97, y: 56, size: .24, delay: -1.2 }, { x: 87, y: 83, size: .16, delay: -2.8 },
    { x: 58, y: 97, size: .25, delay: -2 }, { x: 24, y: 92, size: .19, delay: -.2 },
    { x: 4, y: 66, size: .27, delay: -1.4 }, { x: 4, y: 39, size: .17, delay: -2.6 },
  ];

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="realisticSpaceFrame">
      <defs>
        <linearGradient id={metalId} gradientUnits="userSpaceOnUse" x1="8" x2="92" y1="12" y2="88">
          <stop stopColor="#111820" />
          <stop offset=".2" stopColor="#89919a" />
          <stop offset=".38" stopColor="#252c34" />
          <stop offset=".62" stopColor="#aeb4ba" />
          <stop offset=".8" stopColor="#30363d" />
          <stop offset="1" stopColor="#0a0f14" />
        </linearGradient>
      </defs>
      <circle className="realisticSpaceFrame__outerRim" cx="50" cy="50" r="48.8" fill="none" stroke="#03070b" strokeWidth="3.6" />
      <circle className="realisticSpaceFrame__metalRim" cx="50" cy="50" r="48.3" fill="none" stroke={`url(#${metalId})`} strokeWidth="2.4" />
      <circle className="realisticSpaceFrame__innerRim" cx="50" cy="50" r="46.7" fill="none" stroke="#c4c8cb" strokeOpacity=".48" strokeWidth=".45" />
      <circle className="realisticSpaceFrame__orbitTrack" cx="50" cy="50" r="45.4" fill="none" stroke="#d6d9dc" strokeOpacity=".2" strokeWidth=".2" />
      <circle className="realisticSpaceFrame__orbitTrack realisticSpaceFrame__orbitTrack--outer" cx="50" cy="50" r="51" fill="none" stroke="#b7bdc3" strokeOpacity=".17" strokeWidth=".16" strokeDasharray=".7 1.8" />
      {stars.map((star, index) => (
        <circle
          key={index}
          className="realisticSpaceFrame__star"
          cx={star.x}
          cy={star.y}
          r={star.size}
          fill="#f4f1e8"
          style={{ '--realistic-star-delay': `${star.delay}s` } as CSSProperties}
        />
      ))}
      {planets.map((planet) => {
        const coordinate = 50 - planet.radius - planet.size / 2;
        return (
          <g
            key={planet.label}
            className="realisticSpaceFrame__planetOrbit"
            style={{
              '--realistic-orbit-angle': `${planet.angle}deg`,
              '--realistic-orbit-duration': `${planet.duration}s`,
              '--realistic-orbit-delay': `${planet.delay}s`,
            } as CSSProperties}
          >
            <image
              className="realisticSpaceFrame__planet"
              href={planet.src}
              x={50 - planet.size / 2}
              y={coordinate}
              width={planet.size}
              height={planet.size}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        );
      })}
    </svg>
  );
}

function CenterCap() {
  return <div className="centerCap">SPIN</div>;
}

function CenterGem() {
  return <div className="centerGem" aria-hidden="true"><span>✦</span></div>;
}

function NeonCenter() {
  const instanceId = useId().replace(/:/g, '');
  const gradientId = `${instanceId}-center-stroke`;
  const fillId = `${instanceId}-center-fill`;
  const glowId = `${instanceId}-center-glow`;
  const particles = [
    { angle: 0, duration: 5.2, delay: -1.1, size: 1.25, color: '#67e8f9' },
    { angle: 63, duration: 7.4, delay: -5.2, size: .82, color: '#f0abfc' },
    { angle: 127, duration: 6.1, delay: -3.8, size: 1.05, color: '#c4b5fd' },
    { angle: 194, duration: 8.6, delay: -6.7, size: .68, color: '#22d3ee' },
    { angle: 251, duration: 5.8, delay: -2.9, size: 1.12, color: '#f9a8d4' },
    { angle: 319, duration: 7.9, delay: -4.4, size: .76, color: '#a5f3fc' },
  ];

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="neonCenter">
      <defs>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="2.1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="14" x2="86" y1="12" y2="88">
          <stop stopColor="#f0abfc" />
          <stop offset=".28" stopColor="#8b5cf6" />
          <stop offset=".56" stopColor="#67e8f9" />
          <stop offset=".78" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#f9a8d4" />
        </linearGradient>
        <radialGradient id={fillId} cx="38%" cy="30%" r="76%">
          <stop stopColor="#3730a3" />
          <stop offset=".5" stopColor="#17143d" />
          <stop offset="1" stopColor="#070b18" />
        </radialGradient>
      </defs>
      <g className="neonCenter__colorCycle">
        <circle className="neonCenter__aura" cx="50" cy="50" r="46" fill="none" stroke={`url(#${gradientId})`} strokeWidth="7" opacity=".28" filter={`url(#${glowId})`} />
        <circle className="neonCenter__shell" cx="50" cy="50" r="43" fill={`url(#${fillId})`} stroke={`url(#${gradientId})`} strokeWidth="3.2" filter={`url(#${glowId})`} />
        <circle className="neonCenter__runner" cx="50" cy="50" r="39" fill="none" stroke="#f8fafc" strokeWidth="1.25" strokeLinecap="round" filter={`url(#${glowId})`} />
        <circle className="neonCenter__runner neonCenter__runner--reverse" cx="50" cy="50" r="33.5" fill="none" stroke="#c4b5fd" strokeWidth=".75" strokeLinecap="round" />
        <circle className="neonCenter__coreAura" cx="50" cy="50" r="19" fill="#67e8f9" opacity=".18" filter={`url(#${glowId})`} />
        <path className="neonCenter__coreMark" d="M50 32 55.5 44.5 68 50l-12.5 5.5L50 68l-5.5-12.5L32 50l12.5-5.5Z" fill={`url(#${gradientId})`} opacity=".75" filter={`url(#${glowId})`} />
      </g>
      {particles.map((particle, index) => (
        <g
          key={index}
          className="neonCenter__particleOrbit"
          style={{
            '--center-particle-angle': `${particle.angle}deg`,
            '--center-particle-duration': `${particle.duration}s`,
            '--center-particle-delay': `${particle.delay}s`,
          } as CSSProperties}
        >
          <ellipse className="neonCenter__particleTrail" cx="50" cy="6.8" rx={particle.size * 2.5} ry={particle.size * .34} fill={particle.color} filter={`url(#${glowId})`} />
          <circle className="neonCenter__particle" cx="50" cy="6.8" r={particle.size} fill={particle.color} filter={`url(#${glowId})`} />
        </g>
      ))}
      <text className="neonCenter__label" x="50" y="54.5" textAnchor="middle">SPIN</text>
    </svg>
  );
}

function CosmicCenter() {
  const instanceId = useId().replace(/:/g, '');
  const sunId = `${instanceId}-cosmic-sun`;
  const spaceId = `${instanceId}-cosmic-space`;
  const glowId = `${instanceId}-cosmic-center-glow`;
  const orbits = [
    { radius: 23, angle: 18, duration: 6.5, delay: -3.1, size: 2.5, color: '#60a5fa', ring: false },
    { radius: 33.5, angle: 136, duration: 10.5, delay: -7.8, size: 3.2, color: '#fb7185', ring: true },
    { radius: 42, angle: 261, duration: 15.5, delay: -12.2, size: 2.1, color: '#a78bfa', ring: false },
  ];

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="cosmicCenter">
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={spaceId} cx="36%" cy="28%" r="78%">
          <stop stopColor="#1e3a8a" />
          <stop offset=".42" stopColor="#17133a" />
          <stop offset="1" stopColor="#020617" />
        </radialGradient>
        <radialGradient id={sunId} cx="35%" cy="30%" r="72%">
          <stop stopColor="#fff7c2" />
          <stop offset=".35" stopColor="#fbbf24" />
          <stop offset=".72" stopColor="#f97316" />
          <stop offset="1" stopColor="#be123c" />
        </radialGradient>
      </defs>
      <circle className="cosmicCenter__aura" cx="50" cy="50" r="46" fill="#6366f1" opacity=".2" filter={`url(#${glowId})`} />
      <circle className="cosmicCenter__shell" cx="50" cy="50" r="44" fill={`url(#${spaceId})`} stroke="#818cf8" strokeWidth="2.1" filter={`url(#${glowId})`} />
      <g className="cosmicCenter__stars">
        <circle cx="28" cy="29" r=".7" /><circle cx="64" cy="18" r=".45" /><circle cx="78" cy="36" r=".6" />
        <circle cx="18" cy="58" r=".48" /><circle cx="69" cy="76" r=".72" /><circle cx="38" cy="84" r=".4" />
        <circle cx="84" cy="59" r=".38" /><circle cx="38" cy="16" r=".32" />
      </g>
      {orbits.map((orbit, index) => (
        <circle key={index} className="cosmicCenter__orbitTrack" cx="50" cy="50" r={orbit.radius} fill="none" stroke="#c4b5fd" strokeOpacity={.18 + index * .07} strokeWidth=".48" strokeDasharray={index === 1 ? '2 1.5' : undefined} />
      ))}
      {orbits.map((orbit, index) => {
        const y = 50 - orbit.radius;
        return (
          <g
            key={index}
            className="cosmicCenter__planetOrbit"
            style={{
              '--cosmic-center-angle': `${orbit.angle}deg`,
              '--cosmic-center-duration': `${orbit.duration}s`,
              '--cosmic-center-delay': `${orbit.delay}s`,
            } as CSSProperties}
          >
            {orbit.ring && <ellipse cx="50" cy={y} rx={orbit.size * 1.9} ry={orbit.size * .54} fill="none" stroke="#fde68a" strokeWidth=".65" />}
            <circle className="cosmicCenter__planet" cx="50" cy={y} r={orbit.size} fill={orbit.color} filter={`url(#${glowId})`} />
            <circle cx={50 - orbit.size * .3} cy={y - orbit.size * .32} r={orbit.size * .25} fill="#fff" opacity=".62" />
          </g>
        );
      })}
      <circle className="cosmicCenter__sunFlare" cx="50" cy="50" r="17.5" fill="#f59e0b" opacity=".28" filter={`url(#${glowId})`} />
      <circle className="cosmicCenter__sun" cx="50" cy="50" r="13.5" fill={`url(#${sunId})`} filter={`url(#${glowId})`} />
      <path className="cosmicCenter__sunTexture" d="M39.5 46c4 2.6 7.8-2.5 12.2-.5 3.2 1.4 5.7.2 8.4-1.7M38.5 53.5c3.8-1.8 6.5 2 10.2.6 4.4-1.8 7.5 2.2 11.9.2" fill="none" stroke="#fff7c2" strokeOpacity=".48" strokeWidth="1" strokeLinecap="round" />
      <text className="cosmicCenter__label" x="50" y="52.3" textAnchor="middle">SPIN</text>
    </svg>
  );
}

function RealisticSpaceCenter() {
  return (
    <div className="realisticSpaceCenter" aria-hidden="true">
      <span className="realisticSpaceCenter__stars" />
      <span className="realisticSpaceCenter__orbit realisticSpaceCenter__orbit--earth">
        <img src={realisticSpaceAssets.earth} alt="" draggable={false} />
      </span>
      <span className="realisticSpaceCenter__orbit realisticSpaceCenter__orbit--saturn">
        <img src={realisticSpaceAssets.saturn} alt="" draggable={false} />
      </span>
      <img className="realisticSpaceCenter__sun" src={realisticSpaceAssets.sun} alt="" draggable={false} />
    </div>
  );
}

function NeonPointer() {
  const instanceId = useId().replace(/:/g, '');
  const gradientId = `${instanceId}-pointer-stroke`;
  const fillId = `${instanceId}-pointer-fill`;
  const glowId = `${instanceId}-pointer-glow`;
  const pointerPath = 'M24 2.5 42 9.5 33.5 30 24 45.5 14.5 30 6 9.5Z';
  const sparks = [
    { angle: 8, duration: 3.8, delay: -1.7, size: .72, color: '#67e8f9' },
    { angle: 102, duration: 5.1, delay: -4.2, size: .5, color: '#f0abfc' },
    { angle: 206, duration: 4.4, delay: -.8, size: .62, color: '#c4b5fd' },
    { angle: 298, duration: 5.8, delay: -3.3, size: .42, color: '#22d3ee' },
  ];

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="neonPointer">
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.45" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="7" x2="41" y1="5" y2="42">
          <stop stopColor="#f0abfc" />
          <stop offset=".38" stopColor="#8b5cf6" />
          <stop offset=".7" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#f9a8d4" />
        </linearGradient>
        <linearGradient id={fillId} gradientUnits="userSpaceOnUse" x1="12" x2="35" y1="7" y2="42">
          <stop stopColor="#312e81" />
          <stop offset=".55" stopColor="#17143d" />
          <stop offset="1" stopColor="#080d1d" />
        </linearGradient>
      </defs>
      <g className="neonPointer__colorCycle">
        <path className="neonPointer__aura" d={pointerPath} fill="none" stroke={`url(#${gradientId})`} strokeWidth="5" strokeLinejoin="round" opacity=".3" filter={`url(#${glowId})`} />
        <path d={pointerPath} fill={`url(#${fillId})`} stroke={`url(#${gradientId})`} strokeWidth="2.6" strokeLinejoin="round" filter={`url(#${glowId})`} />
        <path className="neonPointer__runner" d={pointerPath} fill="none" stroke="#f8fafc" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} />
        <circle className="neonPointer__coreAura" cx="24" cy="14" r="5.2" fill="#67e8f9" opacity=".22" filter={`url(#${glowId})`} />
        <circle className="neonPointer__core" cx="24" cy="14" r="2.8" fill="#f8fafc" stroke="#67e8f9" strokeWidth=".8" filter={`url(#${glowId})`} />
      </g>
      {sparks.map((spark, index) => (
        <g
          key={index}
          className="neonPointer__sparkOrbit"
          style={{
            '--spark-angle': `${spark.angle}deg`,
            '--spark-duration': `${spark.duration}s`,
            '--spark-delay': `${spark.delay}s`,
          } as CSSProperties}
        >
          <ellipse className="neonPointer__sparkTrail" cx="24" cy="1.5" rx={spark.size * 2.1} ry={spark.size * .34} fill={spark.color} filter={`url(#${glowId})`} />
          <circle className="neonPointer__spark" cx="24" cy="1.5" r={spark.size} fill={spark.color} filter={`url(#${glowId})`} />
        </g>
      ))}
    </svg>
  );
}

function CosmicPointer() {
  const instanceId = useId().replace(/:/g, '');
  const hullId = `${instanceId}-cosmic-pointer-hull`;
  const windowId = `${instanceId}-cosmic-pointer-window`;
  const glowId = `${instanceId}-cosmic-pointer-glow`;
  const rocketPath = 'M24 5.5C31.8 11 34.6 23.8 30.4 34.4L24 45.5l-6.4-11.1C13.4 23.8 16.2 11 24 5.5Z';

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="cosmicPointer">
      <defs>
        <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.35" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={hullId} gradientUnits="userSpaceOnUse" x1="14" x2="34" y1="7" y2="44">
          <stop stopColor="#e0f2fe" />
          <stop offset=".28" stopColor="#818cf8" />
          <stop offset=".62" stopColor="#312e81" />
          <stop offset="1" stopColor="#111827" />
        </linearGradient>
        <radialGradient id={windowId} cx="35%" cy="30%" r="70%">
          <stop stopColor="#fff" />
          <stop offset=".28" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#2563eb" />
        </radialGradient>
      </defs>
      <path className="cosmicPointer__engineAura" d="M19.7 9 24 .5 28.3 9Z" fill="#38bdf8" opacity=".38" filter={`url(#${glowId})`} />
      <path className="cosmicPointer__engine" d="M21 9 24 2.3 27 9Z" fill="#fef3c7" filter={`url(#${glowId})`} />
      <path className="cosmicPointer__aura" d={rocketPath} fill="none" stroke="#818cf8" strokeWidth="5" opacity=".25" filter={`url(#${glowId})`} />
      <path d={rocketPath} fill={`url(#${hullId})`} stroke="#a5f3fc" strokeWidth="1.55" strokeLinejoin="round" filter={`url(#${glowId})`} />
      <path d="m18.2 29-5.8 8.5 6.8-1.4M29.8 29l5.8 8.5-6.8-1.4" fill="#4338ca" stroke="#c4b5fd" strokeWidth="1" strokeLinejoin="round" />
      <path className="cosmicPointer__panel" d="M24 31.5 27.8 37 24 43.2 20.2 37Z" fill="#172554" stroke="#67e8f9" strokeWidth=".55" />
      <circle className="cosmicPointer__windowAura" cx="24" cy="20" r="6.4" fill="#38bdf8" opacity=".2" filter={`url(#${glowId})`} />
      <circle className="cosmicPointer__window" cx="24" cy="20" r="4.4" fill={`url(#${windowId})`} stroke="#e0f2fe" strokeWidth=".8" filter={`url(#${glowId})`} />
      <ellipse cx="22.8" cy="18.5" rx="1.35" ry=".8" fill="#fff" opacity=".72" />
      <g className="cosmicPointer__moonOrbit">
        <circle cx="24" cy="12.6" r=".95" fill="#fbbf24" filter={`url(#${glowId})`} />
      </g>
      <g className="cosmicPointer__stars">
        <circle cx="8" cy="17" r=".55" /><circle cx="40" cy="13" r=".4" /><circle cx="7" cy="29" r=".34" /><circle cx="41" cy="31" r=".5" />
      </g>
    </svg>
  );
}

function RealisticSpacePointer() {
  return (
    <div className="realisticSpacePointer" aria-hidden="true">
      <img src={realisticSpaceAssets.spacecraft} alt="" draggable={false} />
    </div>
  );
}

function ItemEditor({ item, index, selected, onChange, onDelete, onSelect, copy }: {
  item: WheelItem;
  index: number;
  selected: boolean;
  onChange: (change: Partial<WheelItem>) => void;
  onDelete: () => void;
  onSelect: () => void;
  copy: LocaleCopy;
}) {
  return (
    <div className={['itemEditor', selected && 'itemEditor--selected'].filter(Boolean).join(' ')}>
      <input aria-label={`${copy.itemEditor.color}: ${item.label}`} type="color" value={item.color ?? palette[index % palette.length]} onChange={(event) => onChange({ color: event.target.value })} />
      <input aria-label={copy.itemEditor.name} value={item.label} onChange={(event) => onChange({ label: event.target.value })} />
      <label className="weightInput">
        <input aria-label={copy.itemEditor.weight} type="number" min="0" step="1" value={item.weight} onChange={(event) => onChange({ weight: Math.max(0, Number(event.target.value)) })} />
        <span>{copy.itemEditor.weight}</span>
      </label>
      <button className="iconButton" onClick={onSelect} aria-label={`${copy.itemEditor.configure} ${item.label}`} title={copy.itemEditor.configureTitle}>⚙</button>
      <button className="iconButton" onClick={onDelete} aria-label={`${copy.itemEditor.remove} ${item.label}`} title={copy.itemEditor.remove}>×</button>
    </div>
  );
}

function MediaPicker({ label, value, onChange, accept, copy }: { label: string; value: string; onChange: (value: string) => void; accept: string; copy: LocaleCopy }) {
  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) onChange(URL.createObjectURL(file));
    event.currentTarget.value = '';
  };
  return (
    <div className="mediaPicker">
      <label>{label}<input value={value} placeholder={copy.media.placeholder} onChange={(event) => onChange(event.target.value)} /></label>
      <label className="fileButton">{copy.media.file}<input type="file" accept={accept} onChange={loadFile} /></label>
    </div>
  );
}

function SoundPicker({
  label,
  url,
  file,
  onUrlChange,
  onFileChange,
  copy,
}: {
  label: string;
  url: string;
  file?: File;
  onUrlChange: (value: string) => void;
  onFileChange: (file?: File) => void;
  copy: LocaleCopy;
}) {
  const loadFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0];
    if (nextFile) onFileChange(nextFile);
    event.currentTarget.value = '';
  };

  return (
    <div className="soundPicker">
      <label>{label}<input placeholder={copy.media.soundPlaceholder} value={url} onChange={(event) => { onUrlChange(event.target.value); onFileChange(undefined); }} /></label>
      <label className="fileButton">{copy.media.file}<input type="file" accept="audio/*" onChange={loadFile} /></label>
      {file && <div className="soundFile"><span title={file.name}>{file.name}</span><button type="button" onClick={() => onFileChange(undefined)} aria-label={`${copy.media.remove} ${label}`}>×</button></div>}
    </div>
  );
}

export function Playground() {
  const wheel = useWheel();
  const [locale, setLocale] = useState<Locale>('en');
  const [installCopied, setInstallCopied] = useState(false);
  const copy = translations[locale];
  const [activePanel, setActivePanel] = useState<SettingsPanel>('spin');
  const [items, setItems] = useState<WheelItem[]>(initialItems);
  const [winnerId, setWinnerId] = useState(initialItems[0].id);
  const [landing, setLanding] = useState<'center' | 'random'>('center');
  const [wheelSize, setWheelSize] = useState(92);
  const [duration, setDuration] = useState(4800);
  const [spinPreset, setSpinPreset] = useState<SpinPreset>('smooth');
  const [renderer, setRenderer] = useState<WheelRenderer>('auto');
  const [itemsTransitionMode, setItemsTransitionMode] = useState<ItemsTransitionConfig['mode']>('crossfade');
  const [itemsTransitionDuration, setItemsTransitionDuration] = useState(360);
  const [frameMode, setFrameMode] = useState<FrameMode>('realistic-space');
  const [frameUrl, setFrameUrl] = useState('');
  const [centerMode, setCenterMode] = useState<CenterMode>('realistic-space');
  const [centerUrl, setCenterUrl] = useState('');
  const [centerSize, setCenterSize] = useState(25);
  const [idleEnabled, setIdleEnabled] = useState(true);
  const [idleDuration, setIdleDuration] = useState(8000);
  const [idleRotation, setIdleRotation] = useState(4);
  const [idleScale, setIdleScale] = useState(1);
  const [pointerMode, setPointerMode] = useState<PointerMode>('realistic-space');
  const [pointerPosition, setPointerPosition] = useState<WheelPointerPosition>('top');
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(defaultThemeSettings);
  const [selectedItemId, setSelectedItemId] = useState(initialItems[0].id);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [lastPass, setLastPass] = useState('—');
  const [error, setError] = useState<string | null>(null);
  const [tickUrl, setTickUrl] = useState(realisticSpaceAssets.beep);
  const [spinUrl, setSpinUrl] = useState('');
  const [winUrl, setWinUrl] = useState('');
  const [tickFile, setTickFile] = useState<File>();
  const [spinFile, setSpinFile] = useState<File>();
  const [winFile, setWinFile] = useState<File>();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [asyncServer, setAsyncServer] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | undefined>();
  const [hoveredLabel, setHoveredLabel] = useState('—');
  const lastPassReportRef = useRef(0);

  useEffect(() => {
    document.documentElement.lang = locale;
    setItems((current) => current.map((item) => {
      const labels = localizedSeedLabels[item.id as keyof typeof localizedSeedLabels];
      if (!labels || (item.label !== labels.en && item.label !== labels.uk)) return item;
      return { ...item, label: labels[locale] };
    }));
  }, [locale]);

  const spinPresets = {
    smooth: { label: copy.presets.smooth.label, description: copy.presets.smooth.description, animation: spinPresetAnimations.smooth },
    snappy: { label: copy.presets.snappy.label, description: copy.presets.snappy.description, animation: spinPresetAnimations.snappy },
    dramatic: { label: copy.presets.dramatic.label, description: copy.presets.dramatic.description, animation: spinPresetAnimations.dramatic },
    bounce: { label: copy.presets.bounce.label, description: copy.presets.bounce.description, animation: spinPresetAnimations.bounce },
  } as const satisfies Record<string, { label: string; description: string; animation: Omit<SpinAnimationConfig, 'duration'> }>;
  const settingsPanels = settingsPanelIds.map((id) => ({ id, ...copy.panels[id] }));

  const totalWeight = useMemo(() => items.reduce((sum, item) => sum + (item.disabled ? 0 : item.weight), 0), [items]);
  const spinAnimation = useMemo<Partial<SpinAnimationConfig>>(() => ({ ...spinPresets[spinPreset].animation, duration }), [duration, spinPreset]);
  const itemsTransition = useMemo<ItemsTransitionConfig>(() => ({
    enabled: itemsTransitionMode !== 'none',
    mode: itemsTransitionMode,
    duration: itemsTransitionDuration,
    easing: itemsTransitionMode === 'collapse' ? 'cubic-bezier(.22, 1, .36, 1)' : 'cubic-bezier(.22, 1, .36, 1)',
  }), [itemsTransitionDuration, itemsTransitionMode]);
  const idleAnimation = useMemo<Partial<IdleAnimationConfig>>(() => ({
    enabled: idleEnabled,
    duration: idleDuration,
    rotation: idleRotation,
    scale: idleScale,
    easing: 'ease-in-out',
  }), [idleDuration, idleEnabled, idleRotation, idleScale]);
  const wheelTheme = useMemo<WheelThemeOptions>(() => ({
    background: themeSettings.background,
    border: { color: themeSettings.borderColor, width: themeSettings.borderWidth },
    dividers: {
      color: themeSettings.dividerColor,
      width: themeSettings.dividerWidth,
      shadow: {
        color: themeSettings.dividerShadowColor,
        blur: themeSettings.dividerShadowBlur,
        offsetX: themeSettings.dividerShadowX,
        offsetY: themeSettings.dividerShadowY,
      },
    },
    text: {
      color: themeSettings.textColor,
      strokeColor: themeSettings.textStrokeColor,
      strokeWidth: themeSettings.textStrokeWidth,
      shadow: {
        color: themeSettings.textShadowColor,
        blur: themeSettings.textShadowBlur,
        offsetX: themeSettings.textShadowX,
        offsetY: themeSettings.textShadowY,
      },
      fontFamily: themeSettings.fontFamily,
      fontSize: themeSettings.fontSize,
      fontWeight: themeSettings.fontWeight,
      radius: themeSettings.textRadius,
      offsetX: themeSettings.textOffsetX,
      offsetY: themeSettings.textOffsetY,
      orientation: themeSettings.orientation,
      align: themeSettings.align,
      overflow: themeSettings.overflow,
    },
  }), [themeSettings]);
  const sounds: WheelSoundConfig | undefined = soundEnabled ? {
    enabled: true,
    spin: (spinFile ?? spinUrl) || undefined,
    tick: (tickFile ?? tickUrl) || undefined,
    win: (winFile ?? winUrl) || undefined,
    volume: 0.45,
  } : undefined;
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
  const selectedText = { ...wheelTheme.text, ...selectedItem?.text } as SectorTextStyle | undefined;
  const selectedImage = selectedItem?.image
    ? (typeof selectedItem.image === 'string' ? { src: selectedItem.image } : selectedItem.image)
    : undefined;

  const updateTheme = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setThemeSettings((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (id: string, change: Partial<WheelItem>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...change } : item));
  };

  const updateItemText = (id: string, change: Partial<SectorTextStyle>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, text: { ...item.text, ...change } } : item));
  };

  const updateItemImage = (id: string, change: Partial<WheelSectorImage>) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const image = item.image
        ? (typeof item.image === 'string' ? { src: item.image } : item.image)
        : { src: '' };
      return { ...item, image: { ...image, ...change } };
    }));
  };

  const addItem = () => {
    const serial = nextItem++;
    const item: WheelItem = {
      id: `custom-${serial}`,
      label: `${copy.items.prize} ${serial}`,
      weight: 10,
      color: palette[(items.length + serial) % palette.length],
    };
    setItems((current) => [...current, item]);
    setWinnerId(item.id);
    setSelectedItemId(item.id);
  };

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id);
    setItems(nextItems);
    if (winnerId === id) setWinnerId(nextItems[0]?.id ?? '');
    if (selectedItemId === id) setSelectedItemId(nextItems[0]?.id ?? '');
  };

  const loadDenseWheel = (count: number) => {
    const denseItems = Array.from({ length: count }, (_, index): WheelItem => ({
      id: `dense-${count}-${index}`,
      label: `${copy.items.prize} ${index + 1}`,
      weight: 1 + ((index * 7) % 5),
      color: palette[index % palette.length],
    }));
    setItems(denseItems);
    setWinnerId(denseItems[0].id);
    setSelectedItemId(denseItems[0].id);
    setLastResult(copy.errors.denseLoaded(count));
  };

  const resetDemo = () => {
    setItems(initialItems);
    setWinnerId(initialItems[0].id);
    setSelectedItemId(initialItems[0].id);
  };

  const spin = async (mode: 'client' | 'server') => {
    setError(null);
    setIsSpinning(true);
    try {
      const request = mode === 'server'
        ? asyncServer
          ? {
              mode: 'server' as const,
              resolveWinner: async ({ signal }: { signal: AbortSignal }) => {
                await waitForServer(signal);
                return { winnerId, landing: { mode: landing, edgePadding: 0.15 }, animation: spinAnimation };
              },
            }
          : { mode: 'server' as const, winnerId, landing: { mode: landing, edgePadding: 0.15 }, animation: spinAnimation }
        : { mode: 'client' as const, landing: { mode: landing, edgePadding: 0.15 }, animation: spinAnimation };
      const result = await wheel.spin(request);
      setLastResult(copy.errors.winner(result.winner.label, mode));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSpinning(false);
    }
  };

  const copyInstallCommand = async () => {
    try {
      await navigator.clipboard.writeText(npmInstallCommand);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = npmInstallCommand;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setInstallCopied(true);
    window.setTimeout(() => setInstallCopied(false), 1800);
  };

  const overlay = frameMode === 'classic' ? <FrameOverlay />
    : frameMode === 'neon' ? <NeonFrameOverlay />
      : frameMode === 'cosmic' ? <CosmicFrameOverlay />
        : frameMode === 'realistic-space' ? <RealisticSpaceFrameOverlay />
          : frameMode === 'custom' && frameUrl ? <WheelMedia src={frameUrl} alt={copy.media.customFrame} className="slotMedia slotMedia--frame" />
            : undefined;
  const center = centerMode === 'cap' ? <CenterCap />
    : centerMode === 'gem' ? <CenterGem />
      : centerMode === 'neon' ? <NeonCenter />
        : centerMode === 'cosmic' ? <CosmicCenter />
          : centerMode === 'realistic-space' ? <RealisticSpaceCenter />
            : centerMode === 'custom' && centerUrl ? <WheelMedia src={centerUrl} alt={copy.media.centerImage} className="slotMedia slotMedia--center" />
              : undefined;
  const pointer = pointerMode === 'neon' ? <NeonPointer />
    : pointerMode === 'cosmic' ? <CosmicPointer />
      : pointerMode === 'realistic-space' ? <RealisticSpacePointer />
        : undefined;

  return (
    <main className="playground">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <nav className="siteNav" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Wheel of Fortune React home">
          <span className="brandMark" aria-hidden="true"><span /></span>
          <span>@cxde/wheel-of-fortune</span>
        </a>
        <div className="navLinks">
          <a href="#quick-start">{copy.landing.navQuickStart}</a>
          <a href="#playground">{copy.landing.navPlayground}</a>
          <span className="versionBadge">{copy.landing.version}</span>
          <div className="languageSwitch" role="group" aria-label={copy.language.label}>
            <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')} aria-pressed={locale === 'en'}>EN</button>
            <button className={locale === 'uk' ? 'active' : ''} onClick={() => setLocale('uk')} aria-pressed={locale === 'uk'}>UA</button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="heroContent" id="top">
          <p className="eyebrow"><span className="statusDot" />{copy.hero.badge}</p>
          <h1>{copy.hero.title}<br /><span>{copy.hero.titleHighlight}</span></h1>
          <p className="heroCopy">{copy.hero.copy}</p>
          <div className="heroActions">
            <a className="heroPrimary" href="#playground">{copy.hero.openPlayground}<span aria-hidden="true">↘</span></a>
            <button className={`installButton${installCopied ? ' installButton--copied' : ''}`} onClick={() => void copyInstallCommand()}>
              <span className="prompt" aria-hidden="true">$</span>
              <code>{npmInstallCommand}</code>
              <span className="copyLabel">{installCopied ? copy.hero.copied : copy.hero.copyInstall}</span>
            </button>
          </div>
        </div>

        <aside className="quickStartCard" id="quick-start" aria-labelledby="quick-start-title">
          <div className="codeWindowBar">
            <span className="windowDots" aria-hidden="true"><i /><i /><i /></span>
            <span>{copy.landing.codeFile}</span>
            <span>TSX</span>
          </div>
          <div className="quickStartHeader">
            <div>
              <p>01 / {copy.landing.quickStart}</p>
              <h2 id="quick-start-title">{copy.landing.quickIntro}</h2>
            </div>
            <span className="quickStartIcon" aria-hidden="true">⌁</span>
          </div>
          <div className="installStep">
            <span>{copy.landing.installStep}</span>
            <button onClick={() => void copyInstallCommand()} aria-label={copy.hero.copyInstall}>
              <code><b>$</b> {npmInstallCommand}</code>
              <span aria-hidden="true">{installCopied ? '✓' : '⧉'}</span>
            </button>
          </div>
          <div className="codeStep">
            <span>{copy.landing.useStep}</span>
            <pre><code>{`import { Wheel, useWheel } from '@cxde/wheel-of-fortune';
import '@cxde/wheel-of-fortune/style.css';

const items = [
  { id: 'gift', label: 'Gift', weight: 1 },
  { id: 'bonus', label: 'Bonus', weight: 1 },
];

function PrizeWheel() {
  const wheel = useWheel();

  return (
    <>
      <Wheel items={items} controller={wheel} />
      <button onClick={() => void wheel.spin()}>
        Spin
      </button>
    </>
  );
}`}</code></pre>
          </div>
          <p className="quickStartNote">{copy.landing.instruction}</p>
        </aside>
      </header>

      <section className="featureRail" aria-label="Library highlights">
        {copy.landing.features.map((feature, index) => (
          <div className="featureMetric" key={feature.value} style={{ '--feature-index': index } as CSSProperties}>
            <span>{feature.value}</span>
            <small>{feature.label}</small>
          </div>
        ))}
      </section>

      <section className="playgroundIntro" id="playground">
        <div>
          <p className="eyebrow">{copy.landing.labEyebrow}</p>
          <h2>{copy.landing.labTitle}</h2>
          <p>{copy.landing.labCopy}</p>
        </div>
        <div className="performanceNote"><span>60+ FPS</span><small dangerouslySetInnerHTML={{ __html: copy.hero.compositor }} /></div>
      </section>

      <div className="playgroundGrid">
        <section className="stage" aria-label={copy.stage.preview}>
          <div className="resultPill" aria-live="polite"><span>{copy.stage.result}</span>{lastResult ?? copy.errors.initial}</div>
          <div className="wheelStage" style={{ '--preview-size': `${wheelSize}%` } as CSSProperties}>
            <Wheel
              items={items}
              controller={wheel}
              size="var(--preview-size)"
              renderer={renderer}
              itemsTransition={itemsTransition}
              theme={wheelTheme}
              pointer={pointer}
              pointerPosition={pointerPosition}
              overlay={overlay}
              center={center}
              centerSize={`${centerSize}%`}
              sounds={sounds}
              spinAnimation={spinAnimation}
              idleAnimation={idleAnimation}
              minLabelAngle={8}
              highlightedItemId={hoveredItemId}
              onSectorHover={(sector) => {
                setHoveredItemId(sector?.item.id);
                setHoveredLabel(sector?.item.label ?? '—');
              }}
              onSectorClick={({ item }) => {
                setWinnerId(item.id);
                setSelectedItemId(item.id);
                setLastResult(copy.errors.selectedServer(item.label));
              }}
              onSectorPass={(item) => {
                const now = performance.now();
                if (now - lastPassReportRef.current < 70) return;
                lastPassReportRef.current = now;
                setLastPass(item.label);
              }}
              onError={(nextError) => setError(nextError.message)}
            />
          </div>
          <div className="stageMeta"><span>{copy.stage.lastTick}: <strong>{lastPass}</strong></span><span>{copy.stage.underCursor}: <strong>{hoveredLabel}</strong></span><span>{copy.stage.sectors(items.length)} · {copy.stage.weight} {totalWeight} · {renderer}</span></div>
        </section>

        <aside className="controls">
          <div className="settingsNav">
            <div className="settingsNavTitle">
              <div><span>Playground</span><h2>{copy.settings.title}</h2></div>
              <span className="settingsCount">{copy.stage.sectors(items.length)}</span>
            </div>
            <div className="settingsTabs" role="tablist" aria-label={copy.settings.groups}>
              {settingsPanels.map((panel, panelIndex) => (
                <button
                  key={panel.id}
                  id={`settings-tab-${panel.id}`}
                  role="tab"
                  aria-selected={activePanel === panel.id}
                  aria-controls={`settings-panel-${panel.id}`}
                  className={activePanel === panel.id ? 'active' : ''}
                  onClick={() => setActivePanel(panel.id)}
                  onKeyDown={(event) => {
                    const lastIndex = settingsPanels.length - 1;
                    const nextIndex = event.key === 'ArrowRight' ? (panelIndex + 1) % settingsPanels.length
                      : event.key === 'ArrowLeft' ? (panelIndex - 1 + settingsPanels.length) % settingsPanels.length
                        : event.key === 'Home' ? 0
                          : event.key === 'End' ? lastIndex
                            : panelIndex;
                    if (nextIndex === panelIndex && !['Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const nextPanel = settingsPanels[nextIndex];
                    setActivePanel(nextPanel.id);
                    document.getElementById(`settings-tab-${nextPanel.id}`)?.focus();
                  }}
                >
                  {panel.label}
                </button>
              ))}
            </div>
            <p className="settingsDescription">{settingsPanels.find((panel) => panel.id === activePanel)?.description}</p>
          </div>

          {activePanel === 'spin' && <div className="settingsPanel" id="settings-panel-spin" role="tabpanel" aria-labelledby="settings-tab-spin">
          <section className="controlSection">
            <div className="sectionTitle"><h2>{copy.spin.title}</h2><span>Web Animations API</span></div>
            <div className="spinButtons">
              <button className="primaryButton" disabled={!items.length || isSpinning} onClick={() => void spin('client')}>{isSpinning ? copy.spin.spinning : copy.spin.random}</button>
              <button className="secondaryButton" disabled={!winnerId || isSpinning} onClick={() => void spin('server')}>{copy.spin.server}</button>
            </div>
            {isSpinning && <button className="textButton" onClick={() => wheel.cancel('Cancelled from playground')}>{copy.spin.cancel}</button>}
            <label className="selectField">{copy.spin.serverWinner}
              <select value={winnerId} onChange={(event) => setWinnerId(event.target.value)}>
                {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <div className="segmented" role="group" aria-label={copy.spin.landing}>
              <button className={landing === 'center' ? 'active' : ''} onClick={() => setLanding('center')}>{copy.spin.center}</button>
              <button className={landing === 'random' ? 'active' : ''} onClick={() => setLanding('random')}>{copy.spin.randomInside}</button>
            </div>
            <label className="selectField topField">{copy.spin.preset}
              <select value={spinPreset} onChange={(event) => setSpinPreset(event.target.value as SpinPreset)}>
                {Object.entries(spinPresets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
              </select>
            </label>
            <p className="fieldHint">{spinPresets[spinPreset].description} · {typeof spinPresets[spinPreset].animation.rotations === 'number' ? spinPresets[spinPreset].animation.rotations : `${spinPresets[spinPreset].animation.rotations.min}–${spinPresets[spinPreset].animation.rotations.max}`} {copy.spin.rotations}</p>
            <label className="rangeField">{copy.spin.duration} <output>{(duration / 1000).toFixed(1)} {copy.spin.seconds}</output>
              <input type="range" min="1000" max="9000" step="100" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
            </label>
            <label className="asyncServer"><input type="checkbox" checked={asyncServer} onChange={(event) => setAsyncServer(event.target.checked)} /> {copy.spin.async}</label>
          </section>
          </div>}

          {activePanel === 'appearance' && <div className="settingsPanel" id="settings-panel-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance">
          <section className="controlSection">
            <div className="sectionTitle"><h2>{copy.appearance.title}</h2><span>ReactNode slots</span></div>
            <label className="selectField">{copy.appearance.rendering}
              <select value={renderer} onChange={(event) => setRenderer(event.target.value as WheelRenderer)}>
                <option value="auto">{copy.appearance.auto}</option>
                <option value="svg">{copy.appearance.svg}</option>
                <option value="canvas">{copy.appearance.canvas}</option>
              </select>
            </label>
            <label className="rangeField">{copy.appearance.size} <output>{wheelSize}%</output>
              <input type="range" min="50" max="100" value={wheelSize} onChange={(event) => setWheelSize(Number(event.target.value))} />
            </label>
            <div className="twoColumns">
              <label className="selectField">{copy.appearance.frame}
                <select value={frameMode} onChange={(event) => setFrameMode(event.target.value as FrameMode)}>
                  <option value="classic">{copy.appearance.classic}</option><option value="neon">{copy.appearance.neon}</option><option value="cosmic">{copy.appearance.cosmic}</option><option value="realistic-space">{copy.appearance.realistic}</option><option value="custom">{copy.appearance.custom}</option><option value="none">{copy.appearance.none}</option>
                </select>
              </label>
              <label className="selectField">{copy.appearance.center}
                <select value={centerMode} onChange={(event) => setCenterMode(event.target.value as CenterMode)}>
                  <option value="cap">{copy.appearance.cap}</option><option value="gem">{copy.appearance.gem}</option><option value="neon">{copy.appearance.neon}</option><option value="cosmic">{copy.appearance.miniSolar}</option><option value="realistic-space">{copy.appearance.realisticSolar}</option><option value="custom">{copy.appearance.custom}</option><option value="none">{copy.appearance.noCenter}</option>
                </select>
              </label>
            </div>
            {frameMode === 'custom' && <MediaPicker label={copy.appearance.frameMedia} value={frameUrl} onChange={setFrameUrl} accept="image/*,video/webm,video/mp4" copy={copy} />}
            {centerMode === 'custom' && <MediaPicker label={copy.appearance.centerMedia} value={centerUrl} onChange={setCenterUrl} accept="image/*,video/webm,video/mp4" copy={copy} />}
            <label className="rangeField">{copy.appearance.centerSize} <output>{centerSize}%</output>
              <input type="range" min="8" max="55" value={centerSize} onChange={(event) => setCenterSize(Number(event.target.value))} />
            </label>
            <div className="twoColumns topField">
              <label className="selectField">{copy.appearance.pointerPosition}
                <select value={pointerPosition} onChange={(event) => setPointerPosition(event.target.value as WheelPointerPosition)}>
                  <option value="top">{copy.appearance.top}</option>
                  <option value="right">{copy.appearance.right}</option>
                </select>
              </label>
              <label className="selectField">{copy.appearance.pointer}
                <select value={pointerMode} onChange={(event) => setPointerMode(event.target.value as PointerMode)}>
                  <option value="default">{copy.appearance.defaultPointer}</option>
                  <option value="neon">{copy.appearance.neon}</option>
                  <option value="cosmic">{copy.appearance.cosmicPointer}</option>
                  <option value="realistic-space">{copy.appearance.realisticPointer}</option>
                </select>
              </label>
            </div>
          </section>

          <section className="controlSection">
            <div className="sectionTitle"><h2>{copy.theme.title}</h2><button className="textButton" onClick={() => setThemeSettings(defaultThemeSettings)}>{copy.theme.reset}</button></div>
            <details className="controlDisclosure" open>
              <summary>{copy.theme.colors}</summary>
              <div className="disclosureBody">
                <div className="themeGrid">
                  <label>{copy.theme.wheelBackground}<input type="color" value={themeSettings.background} onChange={(event) => updateTheme('background', event.target.value)} /></label>
                  <label>{copy.theme.text}<input type="color" value={themeSettings.textColor} onChange={(event) => updateTheme('textColor', event.target.value)} /></label>
                  <label>{copy.theme.border}<input type="color" value={themeSettings.borderColor} onChange={(event) => updateTheme('borderColor', event.target.value)} /></label>
                  <label>{copy.theme.dividers}<input type="color" value={themeSettings.dividerColor} onChange={(event) => updateTheme('dividerColor', event.target.value)} /></label>
                </div>
                <div className="twoColumns topField">
                  <label className="rangeField compactRange">{copy.theme.border} <output>{themeSettings.borderWidth.toFixed(2)}</output><input type="range" min="0" max="2" step=".05" value={themeSettings.borderWidth} onChange={(event) => updateTheme('borderWidth', Number(event.target.value))} /></label>
                  <label className="rangeField compactRange">{copy.theme.dividers} <output>{themeSettings.dividerWidth.toFixed(2)}</output><input type="range" min="0" max="2" step=".05" value={themeSettings.dividerWidth} onChange={(event) => updateTheme('dividerWidth', Number(event.target.value))} /></label>
                </div>
                <div className="themeGrid topField">
                  <label>{copy.theme.dividerShadow}<input type="color" value={themeSettings.dividerShadowColor} onChange={(event) => updateTheme('dividerShadowColor', event.target.value)} /></label>
                  <label>{copy.theme.blur}<input type="number" min="0" max="8" step=".1" value={themeSettings.dividerShadowBlur} onChange={(event) => updateTheme('dividerShadowBlur', Number(event.target.value))} /></label>
                  <label>{copy.theme.offsetX}<input type="number" min="-8" max="8" step=".1" value={themeSettings.dividerShadowX} onChange={(event) => updateTheme('dividerShadowX', Number(event.target.value))} /></label>
                  <label>{copy.theme.offsetY}<input type="number" min="-8" max="8" step=".1" value={themeSettings.dividerShadowY} onChange={(event) => updateTheme('dividerShadowY', Number(event.target.value))} /></label>
                </div>
              </div>
            </details>
            <details className="controlDisclosure">
              <summary>{copy.theme.typography}</summary>
              <div className="disclosureBody">
                <div className="twoColumns">
                  <label className="selectField">{copy.theme.font}<select value={themeSettings.fontFamily} onChange={(event) => updateTheme('fontFamily', event.target.value)}><option value="Inter, ui-sans-serif, system-ui, sans-serif">Inter / system</option><option value="Georgia, serif">Georgia</option><option value="monospace">Monospace</option></select></label>
                  <label className="selectField">{copy.theme.orientation}<select value={themeSettings.orientation} onChange={(event) => updateTheme('orientation', event.target.value as SectorTextStyle['orientation'])}><option value="tangential">{copy.theme.tangential}</option><option value="radial">{copy.theme.radial}</option><option value="horizontal">{copy.theme.horizontal}</option></select></label>
                </div>
                <div className="twoColumns topField">
                  <label className="selectField">{copy.theme.align}<select value={themeSettings.align} onChange={(event) => updateTheme('align', event.target.value as SectorTextStyle['align'])}><option value="middle">{copy.theme.middle}</option><option value="start">{copy.theme.start}</option><option value="end">{copy.theme.end}</option></select></label>
                  <label className="selectField">{copy.theme.overflow}<select value={themeSettings.overflow} onChange={(event) => updateTheme('overflow', event.target.value as SectorTextStyle['overflow'])}><option value="hide">{copy.theme.hide}</option><option value="ellipsis">{copy.theme.ellipsis}</option><option value="shrink">{copy.theme.shrink}</option></select></label>
                </div>
                <div className="threeColumns topField">
                  <label className="rangeField compactRange">{copy.theme.sizeShort} <output>{themeSettings.fontSize.toFixed(1)}</output><input type="range" min="1.5" max="7" step=".1" value={themeSettings.fontSize} onChange={(event) => updateTheme('fontSize', Number(event.target.value))} /></label>
                  <label className="rangeField compactRange">{copy.theme.weightShort} <output>{themeSettings.fontWeight}</output><input type="range" min="300" max="900" step="100" value={themeSettings.fontWeight} onChange={(event) => updateTheme('fontWeight', Number(event.target.value))} /></label>
                  <label className="rangeField compactRange">{copy.theme.radius} <output>{themeSettings.textRadius.toFixed(2)}</output><input type="range" min=".1" max=".95" step=".01" value={themeSettings.textRadius} onChange={(event) => updateTheme('textRadius', Number(event.target.value))} /></label>
                </div>
              </div>
            </details>
            <details className="controlDisclosure">
              <summary>{copy.theme.textEffects}</summary>
              <div className="disclosureBody">
                <div className="themeGrid">
                  <label>{copy.theme.textStroke}<input type="color" value={themeSettings.textStrokeColor} onChange={(event) => updateTheme('textStrokeColor', event.target.value)} /></label>
                  <label>{copy.theme.thickness}<input type="number" min="0" max="1.5" step=".05" value={themeSettings.textStrokeWidth} onChange={(event) => updateTheme('textStrokeWidth', Number(event.target.value))} /></label>
                  <label>{copy.theme.shadow}<input type="color" value={themeSettings.textShadowColor} onChange={(event) => updateTheme('textShadowColor', event.target.value)} /></label>
                  <label>{copy.theme.blur}<input type="number" min="0" max="8" step=".1" value={themeSettings.textShadowBlur} onChange={(event) => updateTheme('textShadowBlur', Number(event.target.value))} /></label>
                </div>
                <div className="twoColumns topField">
                  <label className="rangeField compactRange">{copy.theme.shadowX} <output>{themeSettings.textShadowX.toFixed(1)}</output><input type="range" min="-6" max="6" step=".1" value={themeSettings.textShadowX} onChange={(event) => updateTheme('textShadowX', Number(event.target.value))} /></label>
                  <label className="rangeField compactRange">{copy.theme.shadowY} <output>{themeSettings.textShadowY.toFixed(1)}</output><input type="range" min="-6" max="6" step=".1" value={themeSettings.textShadowY} onChange={(event) => updateTheme('textShadowY', Number(event.target.value))} /></label>
                </div>
              </div>
            </details>
          </section>
          </div>}

          {activePanel === 'sectors' && <div className="settingsPanel" id="settings-panel-sectors" role="tabpanel" aria-labelledby="settings-tab-sectors">
          <section className="controlSection">
            <div className="sectionTitle"><h2>{copy.sectors.addRemove}</h2><span>itemsTransition</span></div>
            <label className="selectField">{copy.sectors.transition}
              <select value={itemsTransitionMode} onChange={(event) => setItemsTransitionMode(event.target.value as ItemsTransitionConfig['mode'])}>
                <option value="crossfade">Crossfade</option><option value="collapse">{copy.sectors.collapse}</option><option value="none">{copy.sectors.noAnimation}</option>
              </select>
            </label>
            <label className="rangeField">{copy.sectors.duration} <output>{itemsTransitionDuration} ms</output>
              <input disabled={itemsTransitionMode === 'none'} type="range" min="120" max="1200" step="20" value={itemsTransitionDuration} onChange={(event) => setItemsTransitionDuration(Number(event.target.value))} />
            </label>
            <p className="fieldHint">{copy.sectors.transitionHint}</p>
          </section>

          <section className="controlSection">
            <div className="sectionTitle"><h2>{copy.sectors.title}</h2>{items.length <= 40 ? <button className="textButton" onClick={addItem}>{copy.sectors.add}</button> : <button className="textButton" onClick={resetDemo}>{copy.sectors.restore}</button>}</div>
            <div className="denseActions">
              <span>{copy.sectors.loadTest}</span>
              <button onClick={() => loadDenseWheel(100)}>100</button>
              <button onClick={() => loadDenseWheel(1000)}>1000</button>
            </div>
            <div className="itemList">
              {items.length <= 40 && items.map((item, index) => <ItemEditor key={item.id} item={item} index={index} selected={item.id === selectedItemId} onSelect={() => setSelectedItemId(item.id)} onChange={(change) => updateItem(item.id, change)} onDelete={() => removeItem(item.id)} copy={copy} />)}
              {items.length > 40 && <p className="empty">{copy.sectors.hidden(items.length)}</p>}
              {!items.length && <p className="empty">{copy.sectors.empty}</p>}
            </div>
            {selectedItem && items.length <= 40 && selectedText && <div className="sectorTextEditor">
              <div className="sectionTitle"><h3>{copy.sectors.textTitle}: {selectedItem.label || copy.itemEditor.untitled}</h3><button className="textButton" onClick={() => updateItem(selectedItem.id, { text: undefined })}>{copy.sectors.resetOverride}</button></div>
              <details className="controlDisclosure editorDisclosure">
                <summary>{copy.sectors.imageSection} <span>{selectedImage?.src ? copy.sectors.added : copy.sectors.notSet}</span></summary>
                <div className="disclosureBody">
                  <MediaPicker label={copy.sectors.imageOverColor} value={selectedImage?.src ?? ''} onChange={(src) => updateItemImage(selectedItem.id, { src })} accept="image/*" copy={copy} />
                  <div className="threeColumns topField">
                    <label className="rangeField compactRange">{copy.sectors.opacity} <output>{Math.round((selectedImage?.opacity ?? 1) * 100)}%</output><input type="range" min="0" max="1" step=".05" value={selectedImage?.opacity ?? 1} onChange={(event) => updateItemImage(selectedItem.id, { opacity: Number(event.target.value) })} /></label>
                    <label className="rangeField compactRange">{copy.sectors.scale} <output>{(selectedImage?.scale ?? 1).toFixed(2)}×</output><input disabled={!selectedImage?.src} type="range" min=".25" max="3" step=".05" value={selectedImage?.scale ?? 1} onChange={(event) => updateItemImage(selectedItem.id, { scale: Number(event.target.value) })} /></label>
                    <label className="rangeField compactRange">{copy.sectors.rotation} <output>{Math.round(selectedImage?.rotation ?? 0)}°</output><input disabled={!selectedImage?.src} type="range" min="-180" max="180" step="1" value={selectedImage?.rotation ?? 0} onChange={(event) => updateItemImage(selectedItem.id, { rotation: Number(event.target.value) })} /></label>
                    <label className="rangeField compactRange">{copy.sectors.imageOffsetX} <output>{Math.round(selectedImage?.offsetX ?? 0)}</output><input disabled={!selectedImage?.src} type="range" min="-50" max="50" step="1" value={selectedImage?.offsetX ?? 0} onChange={(event) => updateItemImage(selectedItem.id, { offsetX: Number(event.target.value) })} /></label>
                    <label className="rangeField compactRange">{copy.sectors.imageOffsetY} <output>{Math.round(selectedImage?.offsetY ?? 0)}</output><input disabled={!selectedImage?.src} type="range" min="-50" max="50" step="1" value={selectedImage?.offsetY ?? 0} onChange={(event) => updateItemImage(selectedItem.id, { offsetY: Number(event.target.value) })} /></label>
                    <label className="selectField">{copy.sectors.fit}<select value={selectedImage?.fit ?? 'cover'} onChange={(event) => updateItemImage(selectedItem.id, { fit: event.target.value as WheelSectorImage['fit'] })}><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">{copy.sectors.stretch}</option></select></label>
                    <button className="secondaryButton clearImageButton" disabled={!selectedItem.image} onClick={() => updateItem(selectedItem.id, { image: undefined })}>{copy.sectors.removeImage}</button>
                  </div>
                </div>
              </details>
              <details className="controlDisclosure editorDisclosure" open>
                <summary>{copy.sectors.sectorText}</summary>
                <div className="disclosureBody">
              <div className="themeGrid"><label>{copy.theme.color}<input type="color" value={selectedText.color} onChange={(event) => updateItemText(selectedItem.id, { color: event.target.value })} /></label><label>{copy.theme.sizeShort}<input type="number" min="1" max="10" step=".1" value={selectedText.fontSize} onChange={(event) => updateItemText(selectedItem.id, { fontSize: Number(event.target.value) })} /></label><label>{copy.theme.offsetX}<input type="number" min="-50" max="50" value={selectedText.offsetX} onChange={(event) => updateItemText(selectedItem.id, { offsetX: Number(event.target.value) })} /></label><label>{copy.theme.offsetY}<input type="number" min="-50" max="50" value={selectedText.offsetY} onChange={(event) => updateItemText(selectedItem.id, { offsetY: Number(event.target.value) })} /></label></div>
              <div className="themeGrid"><label>{copy.theme.textStroke}<input type="color" value={selectedText.strokeColor} onChange={(event) => updateItemText(selectedItem.id, { strokeColor: event.target.value })} /></label><label>{copy.theme.thickness}<input type="number" min="0" max="1.5" step=".05" value={selectedText.strokeWidth} onChange={(event) => updateItemText(selectedItem.id, { strokeWidth: Number(event.target.value) })} /></label><label>{copy.theme.shadow}<input type="color" value={selectedText.shadow.color} onChange={(event) => updateItemText(selectedItem.id, { shadow: { ...selectedText.shadow, color: event.target.value } })} /></label><label>{copy.theme.blur}<input type="number" min="0" max="8" step=".1" value={selectedText.shadow.blur} onChange={(event) => updateItemText(selectedItem.id, { shadow: { ...selectedText.shadow, blur: Number(event.target.value) } })} /></label></div>
              <div className="twoColumns"><label className="rangeField compactRange">{copy.theme.shadowX} <output>{selectedText.shadow.offsetX.toFixed(1)}</output><input type="range" min="-6" max="6" step=".1" value={selectedText.shadow.offsetX} onChange={(event) => updateItemText(selectedItem.id, { shadow: { ...selectedText.shadow, offsetX: Number(event.target.value) } })} /></label><label className="rangeField compactRange">{copy.theme.shadowY} <output>{selectedText.shadow.offsetY.toFixed(1)}</output><input type="range" min="-6" max="6" step=".1" value={selectedText.shadow.offsetY} onChange={(event) => updateItemText(selectedItem.id, { shadow: { ...selectedText.shadow, offsetY: Number(event.target.value) } })} /></label></div>
              <div className="threeColumns topField"><label className="selectField">{copy.theme.font}<select value={selectedText.fontFamily} onChange={(event) => updateItemText(selectedItem.id, { fontFamily: event.target.value })}><option value="Inter, ui-sans-serif, system-ui, sans-serif">Inter / system</option><option value="Georgia, serif">Georgia</option><option value="monospace">Monospace</option></select></label><label className="selectField">{copy.theme.orientation}<select value={selectedText.orientation} onChange={(event) => updateItemText(selectedItem.id, { orientation: event.target.value as SectorTextStyle['orientation'] })}><option value="tangential">{copy.theme.tangential}</option><option value="radial">{copy.theme.radial}</option><option value="horizontal">{copy.theme.horizontal}</option></select></label><label className="selectField">{copy.theme.overflow}<select value={selectedText.overflow} onChange={(event) => updateItemText(selectedItem.id, { overflow: event.target.value as SectorTextStyle['overflow'] })}><option value="hide">{copy.theme.hide}</option><option value="ellipsis">{copy.theme.ellipsis}</option><option value="shrink">{copy.theme.shrink}</option></select></label></div>
              <div className="threeColumns topField"><label className="rangeField compactRange">{copy.theme.weightShort} <output>{selectedText.fontWeight}</output><input type="range" min="300" max="900" step="100" value={Number(selectedText.fontWeight)} onChange={(event) => updateItemText(selectedItem.id, { fontWeight: Number(event.target.value) })} /></label><label className="rangeField compactRange">{copy.theme.radius} <output>{selectedText.radius.toFixed(2)}</output><input type="range" min=".1" max=".95" step=".01" value={selectedText.radius} onChange={(event) => updateItemText(selectedItem.id, { radius: Number(event.target.value) })} /></label><label className="selectField">{copy.theme.align}<select value={selectedText.align} onChange={(event) => updateItemText(selectedItem.id, { align: event.target.value as SectorTextStyle['align'] })}><option value="middle">{copy.theme.middle}</option><option value="start">{copy.theme.start}</option><option value="end">{copy.theme.end}</option></select></label></div>
                </div>
              </details>
            </div>}
          </section>
          </div>}

          {activePanel === 'effects' && <div className="settingsPanel" id="settings-panel-effects" role="tabpanel" aria-labelledby="settings-tab-effects">
          <section className="controlSection">
            <div className="sectionTitle"><h2>{copy.effects.idle}</h2><label className="switch"><input aria-label={copy.effects.idleAria} type="checkbox" checked={idleEnabled} onChange={(event) => setIdleEnabled(event.target.checked)} /><span /></label></div>
            <p className="sectionLead">{copy.effects.idleLead}</p>
            <div className={idleEnabled ? 'idleControls' : 'idleControls idleControls--disabled'}>
              <label className="rangeField compactRange">{copy.effects.period} <output>{(idleDuration / 1000).toFixed(1)} {copy.spin.seconds}</output><input disabled={!idleEnabled} type="range" min="800" max="8000" step="100" value={idleDuration} onChange={(event) => setIdleDuration(Number(event.target.value))} /></label>
              <label className="rangeField compactRange">{copy.effects.rotation} <output>{idleRotation.toFixed(2)}°</output><input disabled={!idleEnabled} type="range" min="0" max="4" step=".05" value={idleRotation} onChange={(event) => setIdleRotation(Number(event.target.value))} /></label>
              <label className="rangeField compactRange">{copy.effects.pulse} <output>{idleScale.toFixed(3)}×</output><input disabled={!idleEnabled} type="range" min="1" max="1.08" step=".005" value={idleScale} onChange={(event) => setIdleScale(Number(event.target.value))} /></label>
            </div>
          </section>

          <section className="controlSection soundSection">
            <div className="sectionTitle"><h2>{copy.effects.sound}</h2><label className="switch"><input aria-label={copy.effects.sound} type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /><span /></label></div>
            <SoundPicker label={copy.effects.start} url={spinUrl} file={spinFile} onUrlChange={setSpinUrl} onFileChange={setSpinFile} copy={copy} />
            <SoundPicker label={copy.effects.sectorPass} url={tickUrl} file={tickFile} onUrlChange={setTickUrl} onFileChange={setTickFile} copy={copy} />
            <SoundPicker label={copy.effects.win} url={winUrl} file={winFile} onUrlChange={setWinUrl} onFileChange={setWinFile} copy={copy} />
          </section>
          </div>}
          {error && <p className="error" role="alert">{error}</p>}
        </aside>
      </div>
      <footer className="siteFooter">
        <a className="brand" href="#top">
          <span className="brandMark" aria-hidden="true"><span /></span>
          <span>@cxde/wheel-of-fortune</span>
        </a>
        <span>React 18+ · TypeScript · SVG / Canvas</span>
        <a href="#top" aria-label="Back to top">↑</a>
      </footer>
    </main>
  );
}
