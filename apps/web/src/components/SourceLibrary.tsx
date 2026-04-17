import type { SourceCatalogEntry } from "@tongyuan/contracts";

interface SourceLibraryProps {
  sources: SourceCatalogEntry[];
}

const SourceLibrary = ({ sources }: SourceLibraryProps) => (
  <section className="panel">
    <div className="panel-header">
      <div>
        <p className="eyebrow">Sources</p>
        <h2>Connected knowledge roots</h2>
      </div>
    </div>
    <div className="source-grid">
      {sources.map((source) => (
        <article key={source.sourceKey} className="source-card">
          <div className="source-heading">
            <strong>{source.workspace}</strong>
            <span className={`health-${source.health}`}>{source.health}</span>
          </div>
          <p>{source.notes}</p>
          <dl>
            <div>
              <dt>App</dt>
              <dd>{source.sourceApp}</dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{source.adapterKey}</dd>
            </div>
            <div>
              <dt>Root</dt>
              <dd>{source.rootPath}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  </section>
);

export default SourceLibrary;
