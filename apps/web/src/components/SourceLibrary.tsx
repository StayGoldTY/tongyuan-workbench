import type { SourceCatalogEntry } from "@tongyuan/contracts";
import {
  formatHealthLabel,
  formatSourceAppLabel,
  formatSourceFamilyLabel,
  formatTimestamp,
} from "../lib/workbenchPresentation";

interface SourceLibraryProps {
  sources: SourceCatalogEntry[];
}

const SourceLibrary = ({ sources }: SourceLibraryProps) => (
  <section className="panel content-panel">
    <div className="panel-header">
      <div className="text-stack">
        <p className="eyebrow">资料来源</p>
        <h2>当前已经纳入童园学习范围的工作资料。</h2>
        <p className="supporting-copy">
          这里适合做资料核对，不打断首页聊天体验。你可以快速确认代码仓库、聊天目录和后续扩展源是否已经接通。
        </p>
      </div>
    </div>
    <div className="source-grid">
      {sources.length > 0 ? (
        sources.map((source) => (
          <article key={source.sourceKey} className="source-card">
            <div className="source-heading">
              <strong>{source.workspace}</strong>
              <span className={`health-${source.health}`}>{formatHealthLabel(source.health)}</span>
            </div>
            <p>{source.notes || "当前还没有补充说明。"}</p>
            <dl>
              <div>
                <dt>来源类别</dt>
                <dd>{formatSourceFamilyLabel(source.sourceFamily)}</dd>
              </div>
              <div>
                <dt>接入方式</dt>
                <dd>{formatSourceAppLabel(source.sourceApp)}</dd>
              </div>
              <div>
                <dt>适配器</dt>
                <dd>{source.adapterKey}</dd>
              </div>
              <div>
                <dt>根目录</dt>
                <dd>{source.rootPath}</dd>
              </div>
              <div>
                <dt>最近发现时间</dt>
                <dd>{formatTimestamp(source.lastDiscoveredAt)}</dd>
              </div>
            </dl>
          </article>
        ))
      ) : (
        <div className="empty-state">
          <strong>当前还没有可展示的知识来源。</strong>
          <p>等同步完成后，这里会按代码、聊天和文档来源分组显示。</p>
        </div>
      )}
    </div>
  </section>
);

export default SourceLibrary;
