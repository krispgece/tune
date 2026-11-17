import type { Tune } from '../app/useTune';
import type { DeviceKind } from '../backend';
import { DeviceIcon } from '../components/ui';
import type { StringKey } from '../i18n';
import { connectionKey } from '../state/devices';
import { Fact } from './DeviceInfo';

const LEAD: Record<DeviceKind, StringKey> = { mouse: 'unsupLeadMs', keyboard: 'unsupLeadKb', headset: 'unsupLeadHs' };
const TYPE: Record<DeviceKind, StringKey> = { mouse: 'msType', keyboard: 'kbType', headset: 'hsType' };

/** A device the app recognizes but has no page for. Nothing is sent to it. */
export function Unsupported({ tune }: { tune: Tune }) {
  const { t } = tune.i18n;
  const summary = tune.selected.summary;
  return (
    <div className="stack stack-20">
      <h1 className="h1">{summary.name}</h1>
      <section aria-labelledby="unsup-title" className="card">
        <div className="row-wrap" style={{ gap: 12, flexWrap: 'nowrap' }}>
          <DeviceIcon kind={summary.kind} large />
          <h2 id="unsup-title" className="h2">
            {t('unsupHead')}
          </h2>
        </div>
        <div className="stack">
          <p style={{ fontSize: 15 }}>{t(LEAD[summary.kind])}</p>
          <p className="small-2">{t('unsupMore')}</p>
        </div>
        <dl className="box facts">
          <Fact term={t('type')}>{t(TYPE[summary.kind])}</Fact>
          <Fact term={t('connection')}>{t(connectionKey(summary))}</Fact>
        </dl>
      </section>
    </div>
  );
}
