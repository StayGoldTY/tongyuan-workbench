import type { Citation, DocumentDetail } from "@tongyuan/contracts";
import {
  formatConfidenceLabel,
  formatSourceAppLabel,
  formatSourceFamilyLabel,
  formatTimestamp,
} from "../lib/workbenchPresentation";

interface CitationDrawerProps {
  citation: Citation | null;
  detail: DocumentDetail | null;
  onClose: () => void;
}

const CitationDrawer = ({ citation, detail, onClose }: CitationDrawerProps) => {
  if (!citation) {
    return null;
  }

  return (
    <aside className="citation-overlay">
      <div className="citation-backdrop" onClick={onClose} />
      <div className="citation-drawer">
        <button className="ghost-button" onClick={onClose} type="button">
          收起来源
        </button>
        <p className="eyebrow">来源依据</p>
        <h3>{citation.title}</h3>
        <p>{detail?.summary ?? citation.excerpt}</p>
        <div className="detail-stack">
          <span>{citation.workspace}</span>
          <span>{formatSourceAppLabel(citation.sourceApp)}</span>
          <span>
            {formatConfidenceLabel(
              citation.confidence >= 0.8 ? "high" : citation.confidence >= 0.5 ? "medium" : "low",
            )}
          </span>
          <span>{formatTimestamp(citation.eventTime)}</span>
          {detail?.sourceFamily ? <span>{formatSourceFamilyLabel(detail.sourceFamily)}</span> : null}
        </div>
        {detail?.tags?.length ? (
          <div className="tag-list">
            {detail.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <pre>{detail?.contentRedacted ?? "正在载入这条引用的脱敏内容..."}</pre>
      </div>
    </aside>
  );
};

export default CitationDrawer;
