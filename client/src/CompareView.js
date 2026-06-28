import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './CompareView.css';

// Derive a human-friendly label for a path from its endpoint (last node).
// Prefers the AI-generated tree label, falling back to truncated content.
function getPathLabel(path) {
  if (!path || path.length === 0) return 'Empty path';
  const endpoint = path[path.length - 1];
  if (endpoint.displayName && endpoint.displayName.trim()) {
    return endpoint.displayName.trim();
  }
  const content = (endpoint.content || '').trim();
  if (!content) return 'Untitled path';
  return content.length > 48 ? content.substring(0, 45) + '...' : content;
}

function CompareColumn({ path, label, badge, accentClass, divergeIndex }) {
  return (
    <section className={`compare-column ${accentClass}`} aria-label={`Path ${badge}: ${label}`}>
      <header className="compare-column-header">
        <span className="compare-badge">{badge}</span>
        <span className="compare-column-title" title={label}>{label}</span>
        <span className="compare-column-meta">{path.length} message{path.length === 1 ? '' : 's'}</span>
      </header>
      <div className="compare-column-body">
        {divergeIndex > 0 && (
          <div className="compare-shared-tag">Shared so far</div>
        )}
        {path.map((node, index) => {
          const isShared = index < divergeIndex;
          const showDivergeMarker = index === divergeIndex && divergeIndex > 0;
          return (
            <React.Fragment key={node.id}>
              {showDivergeMarker && (
                <div className="compare-diverge-marker" role="separator">
                  <span>Paths diverge here</span>
                </div>
              )}
              <div
                className={`compare-message ${node.role === 'user' ? 'user' : 'assistant'} ${isShared ? 'shared' : 'diverged'}`}
              >
                <div className="compare-message-role">{node.role === 'user' ? 'You' : 'AI'}</div>
                <div className="compare-message-bubble">
                  {node.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {node.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    node.content
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

CompareColumn.propTypes = {
  path: PropTypes.array.isRequired,
  label: PropTypes.string.isRequired,
  badge: PropTypes.string.isRequired,
  accentClass: PropTypes.string.isRequired,
  divergeIndex: PropTypes.number.isRequired
};

function CompareView({ pathA, pathB, onClose }) {
  const closeRef = useRef(null);

  // Move focus to the close button once, when the overlay opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const labelA = getPathLabel(pathA);
  const labelB = getPathLabel(pathB);

  // First index at which the two paths differ. They always share the root,
  // so this is the point of divergence (or the length of the shorter path
  // when one path is a prefix of the other).
  const divergeIndex = useMemo(() => {
    const min = Math.min(pathA.length, pathB.length);
    let i = 0;
    while (i < min && pathA[i].id === pathB[i].id) i++;
    return i;
  }, [pathA, pathB]);

  const identical =
    pathA.length === pathB.length && divergeIndex === pathA.length;

  return (
    <div
      className="compare-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Compare two conversation paths"
    >
      <div className="compare-toolbar">
        <h2 className="compare-title">Compare paths</h2>
        <button
          ref={closeRef}
          className="compare-close"
          onClick={onClose}
          aria-label="Close comparison"
        >
          ✕ Close
        </button>
      </div>
      {identical && (
        <div className="compare-identical-note" role="status">
          Both selections are the same path — nothing to compare.
        </div>
      )}
      <div className="compare-columns">
        <CompareColumn
          path={pathA}
          label={labelA}
          badge="1"
          accentClass="accent-a"
          divergeIndex={divergeIndex}
        />
        <CompareColumn
          path={pathB}
          label={labelB}
          badge="2"
          accentClass="accent-b"
          divergeIndex={divergeIndex}
        />
      </div>
    </div>
  );
}

CompareView.propTypes = {
  pathA: PropTypes.array.isRequired,
  pathB: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired
};

export default CompareView;
