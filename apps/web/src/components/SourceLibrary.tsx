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
  <section className="panel">
    <div className="panel-header">
      <div className="text-stack">
        <p className="eyebrow">知识来源</p>
        <h2>当前已接入的资料根目录</h2>
        <p className="supporting-copy">
          这里展示童园当前能读取的知识源，包括代码仓库、聊天目录和后续可扩展的文档资料。
        </p>
      </div>
    </div>
    <div className="source-grid">
      {sources.map((source) => (
        <article key={source.sourceKey} className="source-card">
          <div className="source-heading">
            <strong>{source.workspace}</strong>
            <span className={`health-${source.health}`}>{formatHealthLabel(source.health)}</span>
          </div>
          <p>{source.notes || "当前未提供额外说明。"}</p>
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
      ))}
    </div>
  </section>
);

export default SourceLibrary;
