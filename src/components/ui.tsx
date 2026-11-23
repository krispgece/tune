import {
  BadgeCheck,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CirclePause,
  CircleSlash,
  FlaskConical,
  Headphones,
  Hourglass,
  Info,
  Keyboard,
  LoaderCircle,
  Mouse,
  Save,
  Send,
  type LucideIcon,
} from 'lucide-react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from 'react';

import type { DeviceKind } from '../backend/types';
import type { StringKey } from '../i18n';
import { useI18n, useSetLanguage } from '../i18n/context';
import type { ApplyStatus } from '../state/devices';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'secondary' | 'primary' | 'link';
  large?: boolean;
  icon?: LucideIcon;
  iconAfter?: LucideIcon;
  ref?: Ref<HTMLButtonElement>;
};

export function Button({ variant = 'secondary', large, icon: Icon, iconAfter: After, children, className, ...rest }: ButtonProps) {
  const classes = ['btn', variant === 'secondary' ? '' : variant, large ? 'large' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {Icon && <Icon aria-hidden size={16} />}
      {children !== undefined && <span>{children}</span>}
      {After && <After aria-hidden size={16} />}
    </button>
  );
}

/** A link-styled toggle that shows or hides the element `controls` names. */
export function Disclosure(props: { open: boolean; onToggle: () => void; controls?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className="btn link"
      aria-expanded={props.open}
      aria-controls={props.controls}
      onClick={props.onToggle}
    >
      <span>{props.children}</span>
      <ChevronDown aria-hidden size={16} className="chevron" />
    </button>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  lang?: string;
}

export function Segmented<T extends string | number>(props: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  labelledBy: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const { options, value, onChange } = props;
  return (
    <div
      role="group"
      aria-labelledby={props.labelledBy}
      className={`segmented${props.className ? ' ' + props.className : ''}`}
      style={{ '--cols': options.length, ...props.style } as CSSProperties}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.lang}
          aria-pressed={option.value === value}
          disabled={props.disabled}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** English and Türkçe, each in its own language. */
export function LanguagePicker({ labelledBy, style }: { labelledBy: string; style?: CSSProperties }) {
  const { lang } = useI18n();
  const setLanguage = useSetLanguage();
  return (
    <Segmented
      labelledBy={labelledBy}
      value={lang}
      onChange={setLanguage}
      style={style}
      options={[
        { value: 'en', label: 'English', lang: 'en' },
        { value: 'tr', label: 'Türkçe', lang: 'tr' },
      ]}
    />
  );
}

const STATUS: Record<ApplyStatus, { icon: LucideIcon; tone: string; key: StringKey }> = {
  sending: { icon: LoaderCircle, tone: '', key: 'stSending' },
  verified: { icon: BadgeCheck, tone: 'ok', key: 'stVerified' },
  echoed: { icon: CircleCheck, tone: 'ok', key: 'stEchoed' },
  sent: { icon: Send, tone: '', key: 'stSent' },
  stored: { icon: Save, tone: '', key: 'stStored' },
  waiting: { icon: Hourglass, tone: '', key: 'stWaiting' },
  failed: { icon: CircleAlert, tone: 'warn', key: 'stFailed' },
  own: { icon: Mouse, tone: '', key: 'stOwn' },
  paused: { icon: CirclePause, tone: 'warn', key: 'stPaused' },
  notSent: { icon: CircleSlash, tone: '', key: 'stNotSent' },
};

export function StatusPill({ status }: { status: ApplyStatus }) {
  const { t } = useI18n();
  const { icon: Icon, tone, key } = STATUS[status];
  return (
    <span className={`pill${tone ? ' ' + tone : ''}`}>
      <Icon aria-hidden size={16} className={status === 'sending' ? 'spin' : undefined} />
      {t(key)}
    </span>
  );
}

export function ExperimentalBadge() {
  const { t } = useI18n();
  return (
    <span className="badge">
      <FlaskConical aria-hidden size={14} />
      {t('experimental')}
    </span>
  );
}

export function Note({ children, icon: Icon = Info, strong }: { children: ReactNode; icon?: LucideIcon; strong?: boolean }) {
  return (
    <p className={`note${strong ? ' strong' : ''}`}>
      <Icon aria-hidden size={16} />
      <span>{children}</span>
    </p>
  );
}

export function Toast({ show }: { show: boolean }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center' }}>
      {show && (
        <span className="toast">
          <Check aria-hidden size={16} />
          {t('copied')}
        </span>
      )}
    </div>
  );
}

export function CheckList({ items, labelledBy }: { items: string[]; labelledBy?: string }) {
  return (
    <ul className="check-list" aria-labelledby={labelledBy}>
      {items.map((text) => (
        <li key={text}>
          <Check aria-hidden size={18} strokeWidth={2.2} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

const DEVICE_ICONS: Record<DeviceKind, LucideIcon> = { mouse: Mouse, keyboard: Keyboard, headset: Headphones };

export function DeviceIcon({ kind, large }: { kind: DeviceKind; large?: boolean }) {
  const Icon = DEVICE_ICONS[kind];
  return (
    <span aria-hidden className={`icon-tile${large ? ' large' : ''}`}>
      <Icon size={large ? 22 : 20} strokeWidth={1.75} />
    </span>
  );
}

export function HelpButton({ open, onToggle, controls }: { open: boolean; onToggle: () => void; controls: string }) {
  const { t } = useI18n();
  return (
    <button type="button" className="btn link small" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <CircleHelp aria-hidden size={16} />
      <span>{t('whatMeans')}</span>
    </button>
  );
}
