import React from 'react';
import './BranchInfo.css';

function BranchInfo({ 
  currentBranchLength, 
  totalBranches, 
  onReturnToMain,
  hasMultipleBranches 
}) {
  if (!hasMultipleBranches) return null;

  return (
    <div className="branch-info">
      <div className="branch-stats">
        <span className="branch-stat">
          <span className="stat-label">Current Path:</span>
          <span className="stat-value">{currentBranchLength} messages</span>
        </span>
        <span className="branch-divider">|</span>
        <span className="branch-stat">
          <span className="stat-label">Total Branches:</span>
          <span className="stat-value">{totalBranches}</span>
        </span>
      </div>
      {onReturnToMain && (
        <button 
          className="return-to-main-btn"
          onClick={onReturnToMain}
          title="Return to the longest branch"
        >
          ↩ Main Branch
        </button>
      )}
    </div>
  );
}

export default BranchInfo;