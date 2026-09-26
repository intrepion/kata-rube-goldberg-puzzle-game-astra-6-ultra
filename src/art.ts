/** Original, dependency-free illustrations for the Little Contraptions workshop. */
export type PartArtType = 'ramp' | 'bumper' | 'fan' | 'domino';

const ink = '#28483e';
const mint = '#84c8af';
const cream = '#fffdf5';
const orange = '#ef8d61';

export function partArt(type: PartArtType, options: { small?: boolean } = {}): string {
  const detail = !options.small;
  switch (type) {
    case 'ramp':
      return `<g stroke="${ink}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-51 5v12l14-12M-15 5v12L0 5M23 5v12L38 5M58 5v9" fill="none" opacity=".72"/>
        <rect x="-70" y="-5" width="140" height="10" rx="4" fill="${mint}"/>
        <path d="M-62-1H61" stroke="#c7e9d8" stroke-width="2"/>
        ${detail ? '<path d="M-53 2h3m39 0h3m39 0h3" stroke-width="1.5" opacity=".5"/>' : ''}
      </g>`;
    case 'bumper':
      return `<g stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">
        <circle r="25" fill="#f6ae68"/>
        <circle r="17.5" fill="#f9c489" stroke-width="1.5"/>
        <path d="m-11 4 7-8 7 8 8-8" fill="none" stroke-width="2.5"/>
        <path d="M-16-12a20 20 0 0 1 15-7" fill="none" stroke="#fff2d7" stroke-width="3"/>
        ${detail ? '<path d="m-21 0-3 0M21 0h3M0 21v3M0-24v3" stroke-width="1.5" opacity=".65"/>' : ''}
      </g>`;
    case 'fan':
      return `<g stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="m-9 20-6 9h29l-7-9" fill="${mint}"/>
        <circle r="24" fill="#fffdf5"/>
        <circle r="19" fill="#e2efe5" stroke-width="1.3"/>
        <g class="fan-rotor">
          <path d="M-3-3c-11-12-3-18 4-14 5 3 4 10-1 15" fill="${orange}"/>
          <path d="M4-1c16-3 17 7 10 11-5 3-10-1-12-7" fill="${orange}"/>
          <path d="M-1 4c-5 15-14 12-15 4 0-6 6-8 12-7" fill="${orange}"/>
          <circle r="4.5" fill="#e9b758"/>
        </g>
        <g fill="none" stroke="#71aa92" stroke-width="2" opacity=".75">
          <path d="M32-11h19c9 0 9-11 3-11"/>
          <path d="M34 0h30"/>
          <path d="M32 11h14c8 0 8 9 2 9"/>
        </g>
      </g>`;
    case 'domino':
      return `<g stroke="${ink}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-52 22H52" fill="none" opacity=".25" stroke-width="4"/>
        ${[-40, -20, 0, 20, 40]
          .map(
            (
              x,
              index,
            ) => `<g transform="translate(${x} 0)"><g class="domino-tile" style="--domino-index:${index}">
          <rect x="-6" y="-20" width="12" height="40" rx="2.5" fill="${index % 2 ? '#acd9bf' : mint}"/>
          <path d="M-3 0h6" stroke-width="1.2" opacity=".6"/>
          <circle cy="-9" r="1.3" fill="${ink}" stroke="none"/>
          ${index % 2 ? '<circle cy="9" r="1.3" fill="#28483e" stroke="none"/>' : '<circle cx="-2" cy="6" r="1.15" fill="#28483e" stroke="none"/><circle cx="2" cy="12" r="1.15" fill="#28483e" stroke="none"/>'}
          ${detail ? '<path d="M-2-16v10" stroke="#d9f0df" stroke-width="1.5"/>' : ''}
        </g></g>`,
          )
          .join('')}
      </g>`;
  }
}

export function bellArt(): string {
  return `<g stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cy="29" rx="30" ry="5" fill="#28483e" stroke="none" opacity=".09"/>
    <path d="M-23 25h46l-3 5h-40Z" fill="${mint}" stroke-width="2.6"/>
    <path d="M-25 24v-42q0-7 7-7h35q8 0 8 8v41" fill="none" stroke-width="3"/>
    <path d="M0-25v8" fill="none" stroke-width="3"/>
    <circle cy="-16" r="4" fill="#e9b758" stroke-width="2"/>
    <path d="M-16 7c5-4 2-14 7-19 5-5 13-5 18 0 5 5 2 15 7 19l3 5h-38Z" fill="#e9b758" stroke-width="2.7"/>
    <path d="M-9 3c2-3 0-10 5-13" fill="none" stroke="#ffe2a2" stroke-width="3"/>
    <path d="M-18 8h36" fill="none" stroke="#a97939" stroke-width="1.5"/>
    <path d="M-4 13a4 4 0 0 0 8 0" fill="${orange}" stroke-width="2"/>
    <path d="m-34-8 5 3m0-14 3 4m57 6-5 3m0-14-3 4" fill="none" stroke="#cf9b42" stroke-width="2"/>
  </g>`;
}

export function marbleArt(): string {
  return `<g>
    <circle cy="2" r="12" fill="#28483e" opacity=".1"/>
    <circle r="12" fill="${orange}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M-6-5a8 8 0 0 1 8-3" fill="none" stroke="#ffe7c6" stroke-width="3.2" stroke-linecap="round"/>
    <circle cx="-7" cy="0" r="1.2" fill="#ffe7c6"/>
    <path d="M5 7a8 8 0 0 0 3-5" fill="none" stroke="#cb6e4c" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

export function brandMark(): string {
  return `<g stroke="${ink}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="1" width="38" height="38" rx="12" fill="${mint}" stroke="none"/>
    <circle cx="12" cy="11" r="4" fill="${cream}"/>
    <path d="m7 20 17-5" fill="none"/>
    <path d="m18 23 6 8 4-3-6-8Z" fill="${cream}"/>
    <path d="M30 20h4v12h-4Z" fill="${orange}"/>
    <path d="m9 28 4 4m-3 0h3v-3" fill="none"/>
  </g>`;
}

export function startArt(): string {
  return `<g stroke="${ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M-20-32v32m40-32v32" fill="none"/>
    <path d="M-25-33h50v-7h-50Z" fill="${mint}"/>
    <path d="M-21 4h42" fill="none" stroke="#e9b758" stroke-width="5"/>
    <path d="M25 4h8V-8" fill="none"/>
    <circle cx="33" cy="-10" r="4" fill="${orange}"/>
    <path d="M-26 9h-7m59 0h7" fill="none" opacity=".3"/>
  </g>`;
}

const icons: Record<string, string> = {
  play: '<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.5"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  undo: '<path d="m9 5-5 5 5 5M5 10h10a5 5 0 0 1 0 10h-3"/>',
  rotate: '<path d="M4 9a8 8 0 1 1 0 6M4 4v5h5"/><path d="m11 8 5 4-5 4Z" stroke-width="1.6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6" stroke-width="2.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="m17 9 5 6m0-6-5 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8.5a3 3 0 0 1 6 0c0 2-3 2-3 4.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M20 2v4m-2-2h4M4 19v3m-1.5-1.5h3" stroke-width="1.5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  bulb: '<path d="M8 15a7 7 0 1 1 8 0l-1 3H9Z"/><path d="M9 21h6m-5-7 2-2 2 2M12 12v6"/>',
  trophy:
    '<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6M7 21h10"/>',
};

export function toolIcon(name: string): string {
  return `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] ?? icons.sparkles}</g>`;
}
