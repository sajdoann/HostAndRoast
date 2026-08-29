import { useI18n } from "../i18n";

/** Simple centered loading state used while data resolves. */
export default function Loading() {
  const { t } = useI18n();
  return (
    <section className="section">
      <div className="container center-narrow">
        <div className="spinner" aria-hidden="true" />
        <p className="muted">{t("common.loading")}</p>
      </div>
    </section>
  );
}
