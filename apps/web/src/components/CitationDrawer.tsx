import type { Citation, DocumentDetail } from "@tongyuan/contracts";

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
    <aside className="citation-drawer">
      <button className="ghost-button" onClick={onClose} type="button">
        Close
      </button>
      <p className="eyebrow">Citation</p>
      <h3>{citation.title}</h3>
      <p>{detail?.summary ?? citation.excerpt}</p>
      <div className="detail-stack">
        <span>{citation.workspace}</span>
        <span>{citation.sourceApp}</span>
        <span>Confidence {Math.round(citation.confidence * 100)}%</span>
      </div>
      <pre>{detail?.contentRedacted ?? "Loading citation detail..."}</pre>
    </aside>
  );
};

export default CitationDrawer;
