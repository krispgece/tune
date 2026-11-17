import { useState, type ReactNode } from 'react';

import type { StringKey, Translator } from '../i18n';
import type { ApplyStatus } from '../state/devices';
import { ExperimentalBadge, HelpButton, StatusPill } from './ui';

/** The status names and what they mean, for "What does this mean?". */
export function helpItems({ t }: Translator, sendsSettings: boolean): [string, string][] {
  const pairs: [StringKey, StringKey][] = [
    ['stSending', 'hSending'],
    ['stOk', 'hOk'],
    ['stVerified', 'hVerified'],
    ['stOwn', 'hOwn'],
    ['stPaused', 'hPaused'],
  ];
  if (!sendsSettings) pairs.push(['stNotSent', 'hNotSent']);
  return pairs.map(([term, desc]) => [t(term), t(desc)]);
}

/** A setting group: title, experimental badge, apply status and an explanation of the statuses. */
export function SettingCard(props: {
  id: string;
  title: string;
  note: string;
  status: ApplyStatus;
  help: [string, string][];
  children: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { id } = props;
  return (
    <section aria-labelledby={`${id}-title`} className="card">
      <div className="card-head">
        <div className="card-title">
          <h2 id={`${id}-title`} className="h2">
            {props.title}
          </h2>
          <ExperimentalBadge />
          <p>{props.note}</p>
        </div>
        <div className="card-tools">
          <div aria-live="polite" className="status-slot">
            <StatusPill status={props.status} />
          </div>
          <HelpButton open={helpOpen} onToggle={() => setHelpOpen(!helpOpen)} controls={`${id}-help`} />
        </div>
      </div>
      <div id={`${id}-help`} className="help" hidden={!helpOpen}>
        <ul>
          {props.help.map(([term, desc]) => (
            <li key={term}>
              <strong>{term}:</strong> {desc}
            </li>
          ))}
        </ul>
      </div>
      {props.children}
    </section>
  );
}
