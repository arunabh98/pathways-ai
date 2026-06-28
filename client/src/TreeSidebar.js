import React, { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import Tree from 'react-d3-tree';
import axios from 'axios';
import './TreeSidebar.css';

// Walk the nested tree to return the list of nodes from the root down to the
// node with the given id (inclusive), or null if not found.
function findPathToNode(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return [node];
  if (node.children) {
    for (const child of node.children) {
      const sub = findPathToNode(child, targetId);
      if (sub) return [node, ...sub];
    }
  }
  return null;
}

// Count the leaves (conversation endpoints) of the tree. Two or more leaves
// means there is genuine branching and therefore something to compare.
function countLeaves(node) {
  if (!node) return 0;
  if (!node.children || node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function findNodeById(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

function nodeLabel(node) {
  if (!node) return '';
  if (node.displayName && node.displayName.trim()) return node.displayName.trim();
  const content = (node.content || '').trim();
  if (!content) return node.role === 'user' ? 'Empty message' : 'Empty response';
  return content.length > 32 ? content.substring(0, 29) + '...' : content;
}

const COMPARE_COLORS = ['#ec4899', '#14b8a6'];

function TreeSidebar({ sessionId, onBranchSwitch, currentBranch, isOpen, setIsOpen, onCompare, inert }) {
  const [rawTreeData, setRawTreeData] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [containerDimensions, setContainerDimensions] = useState({ width: 500, height: 600 });
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const treeContainer = useRef(null);

  // Update container dimensions when sidebar opens or resizes
  useEffect(() => {
    if (isOpen && treeContainer.current) {
      const updateDimensions = () => {
        setContainerDimensions({
          width: treeContainer.current.offsetWidth || 500,
          height: treeContainer.current.offsetHeight || 600
        });
      };
      
      // Update immediately and on resize
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isOpen]);

  // Keyboard shortcut for toggling sidebar
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Check for Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        // Don't toggle if user is typing in an input
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setIsOpen]);

  const fetchTree = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:3001/api/session/${sessionId}/tree`);
      setRawTreeData(response.data.tree);
    } catch (error) {
      console.error('Failed to fetch tree:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentBranch]);

  // Transform tree data whenever raw data or search term changes
  useEffect(() => {
    if (rawTreeData) {
      const transformed = transformTreeData(rawTreeData);
      setTreeData(transformed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTreeData, searchTerm, currentBranch]);

  const transformTreeData = (node) => {
    if (!node) return null;
    
    const truncateContent = (content) => {
      if (content.length > 40) {
        return content.substring(0, 37) + '...';
      }
      return content;
    };
    
    const isInCurrentBranch = currentBranch && currentBranch.includes(node.id);
    const nodeName = node.displayName || truncateContent(node.content);
    const isSearchMatch = node.role !== 'user' && searchTerm && nodeName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return {
      name: nodeName,
      attributes: {
        id: node.id,
        role: node.role,
        isActive: isInCurrentBranch,
        isSearchMatch: isSearchMatch
      },
      children: node.children ? node.children.map(transformTreeData) : []
    };
  };

  const handleNodeClick = async (nodeData) => {
    const messageId = nodeData.data ? nodeData.data.attributes.id : nodeData.attributes.id;

    // In compare mode a click selects/deselects the node instead of switching
    // the active branch, so the current conversation is left untouched.
    if (compareMode) {
      toggleCompareSelection(messageId);
      return;
    }

    try {
      await axios.post('http://localhost:3001/api/branch', {
        sessionId,
        fromMessageId: messageId
      });

      await fetchTree();

      if (onBranchSwitch) {
        onBranchSwitch();
      }
    } catch (error) {
      console.error('Failed to switch branch:', error);
    }
  };

  // Toggle a node in the compare selection, capping the selection at two.
  // Selecting a third node drops the oldest so the latest two always win.
  const toggleCompareSelection = (nodeId) => {
    setSelectedForCompare(prev => {
      if (prev.includes(nodeId)) return prev.filter(id => id !== nodeId);
      if (prev.length >= 2) return [prev[1], nodeId];
      return [...prev, nodeId];
    });
  };

  const enterCompareMode = () => {
    setSelectedForCompare([]);
    setCompareMode(true);
  };

  const cancelCompare = () => {
    setCompareMode(false);
    setSelectedForCompare([]);
  };

  const launchCompare = () => {
    if (selectedForCompare.length !== 2 || !rawTreeData) return;
    const pathA = findPathToNode(rawTreeData, selectedForCompare[0]);
    const pathB = findPathToNode(rawTreeData, selectedForCompare[1]);
    if (!pathA || !pathB) return;
    if (onCompare) onCompare(pathA, pathB);
    setCompareMode(false);
    setSelectedForCompare([]);
  };

  const handleNodeMouseOver = (nodeData) => {
    const nodeId = nodeData.data ? nodeData.data.attributes.id : nodeData.attributes.id;
    setHoveredNode(nodeId);
  };

  const handleNodeMouseOut = () => {
    setHoveredNode(null);
  };

  const renderCustomNode = ({ nodeDatum }) => {
    const isUser = nodeDatum.attributes.role === 'user';
    const isActive = nodeDatum.attributes.isActive;
    const isHovered = hoveredNode === nodeDatum.attributes.id;
    const isSearchMatch = nodeDatum.attributes.isSearchMatch;
    const compareIndex = compareMode ? selectedForCompare.indexOf(nodeDatum.attributes.id) : -1;
    const isSelectedForCompare = compareIndex >= 0;
    const compareColor = compareIndex >= 0 ? COMPARE_COLORS[compareIndex] : null;

    return (
      <g
        onClick={() => !isUser && handleNodeClick({ data: nodeDatum })}
        onMouseEnter={() => handleNodeMouseOver({ data: nodeDatum })}
        onMouseLeave={handleNodeMouseOut}
      >
        <defs>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feFlood floodColor="#000000" floodOpacity="0.1"/>
            <feComposite in2="offsetblur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id={`gradient-${nodeDatum.attributes.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isSearchMatch ? '#fbbf24' : isActive ? '#a855f7' : (isUser ? '#9ca3af' : '#60a5fa')} />
            <stop offset="100%" stopColor={isSearchMatch ? '#f59e0b' : isActive ? '#7c3aed' : (isUser ? '#6b7280' : '#3b82f6')} />
          </linearGradient>
        </defs>
        {(isActive || isSearchMatch) && (
          <circle
            r="28"
            fill="none"
            stroke={isSearchMatch ? '#f59e0b' : '#a855f7'}
            strokeWidth="1.5"
            opacity="0.4"
            strokeDasharray="4 2"
          />
        )}
        {isSelectedForCompare && (
          <circle
            r="30"
            fill="none"
            stroke={compareColor}
            strokeWidth="3"
          />
        )}
        {isHovered && (
          <circle
            r="26"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            opacity="0.6"
          />
        )}
        <circle
          r={isHovered ? "24" : "22"}
          fill={`url(#gradient-${nodeDatum.attributes.id})`}
          stroke={isSearchMatch ? '#f59e0b' : isActive ? '#9333ea' : '#ffffff'}
          strokeWidth={isActive || isSearchMatch ? "3" : "2"}
          filter="url(#nodeShadow)"
          style={{ 
            cursor: isUser ? 'default' : 'pointer',
            transition: 'all 0.3s ease'
          }}
        />
        <circle
          r="18"
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="1"
          style={{ pointerEvents: 'none' }}
        />
        <text
          fill="white"
          fontSize="13"
          fontWeight="600"
          x="0"
          y="5"
          textAnchor="middle"
          style={{ 
            pointerEvents: 'none',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
        >
          {isUser ? 'U' : 'AI'}
        </text>
        {!isUser && (
          <foreignObject x="-75" y="35" width="150" height="60">
            <div className="node-label" style={{
              fontSize: '11px',
              textAlign: 'center',
              color: isSearchMatch ? '#92400e' : isActive ? '#7c3aed' : '#4b5563',
              lineHeight: '1.4',
              fontWeight: isSearchMatch || isActive ? '600' : '500',
              padding: '5px 6px',
              background: isSearchMatch ? 'rgba(254, 243, 199, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderRadius: '8px',
              boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.08)',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              maxWidth: '140px',
              margin: '0 auto',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)'
            }}>
              {nodeDatum.name}
            </div>
          </foreignObject>
        )}
        {isSelectedForCompare && (
          <g transform="translate(17, -17)" style={{ pointerEvents: 'none' }}>
            <circle r="10" fill={compareColor} stroke="#ffffff" strokeWidth="2" />
            <text
              fill="white"
              fontSize="11"
              fontWeight="700"
              x="0"
              y="4"
              textAnchor="middle"
            >
              {compareIndex + 1}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Comparison is only possible once the tree actually branches (>= 2 leaves).
  const leafCount = useMemo(() => countLeaves(rawTreeData), [rawTreeData]);
  const canCompare = leafCount >= 2;

  // If branching disappears (e.g. tree resets), drop out of compare mode.
  useEffect(() => {
    if (!canCompare && compareMode) {
      setCompareMode(false);
      setSelectedForCompare([]);
    }
  }, [canCompare, compareMode]);

  // Calculate tree metrics with memoization
  const treeMetrics = useMemo(() => {
    if (!rawTreeData) return { depth: 0, maxBranches: 0 };
    
    let maxDepth = 0;
    let maxBranches = 0;
    
    const traverse = (node, depth = 0) => {
      if (!node) return;
      maxDepth = Math.max(maxDepth, depth);
      if (node.children && Array.isArray(node.children)) {
        maxBranches = Math.max(maxBranches, node.children.length);
        node.children.forEach(child => traverse(child, depth + 1));
      }
    };
    
    traverse(rawTreeData);
    return { depth: maxDepth, maxBranches };
  }, [rawTreeData]);

  // Progressive tree configuration based on depth and complexity
  const treeConfig = useMemo(() => {
    const { depth, maxBranches } = treeMetrics;
    const containerWidth = containerDimensions.width;
    
    // Progressive node sizing with minimum bounds
    const calculateNodeSize = () => {
      // Horizontal spacing decreases more aggressively with depth
      const x = Math.max(60, 110 - (depth * 5));
      // Vertical spacing based on both depth and branches
      const y = Math.max(100, 160 - (depth * 4) - (maxBranches * 3));
      return { x, y };
    };
    
    const nodeSize = calculateNodeSize();
    
    // Calculate zoom to fit the tree width in container
    // Account for: tree width + label overhang (150px) + margins
    const calculateZoom = () => {
      const treeWidth = (depth + 1) * nodeSize.x + 150; // Add 150px for labels and margins
      const fitZoom = (containerWidth * 0.95) / treeWidth; // Use 95% of container width
      
      // Also apply depth-based limits (less aggressive)
      let maxZoom = 1.0;
      if (depth > 4) maxZoom = 0.85;
      if (depth > 6) maxZoom = 0.75;
      if (depth > 10) maxZoom = 0.65;
      
      // Return the smaller of fit zoom and max zoom, with minimum of 0.35
      return Math.max(0.35, Math.min(fitZoom, maxZoom));
    };
    
    // Progressive separation based on complexity
    const calculateSeparation = () => {
      const baseSiblings = 1.4;
      const baseNonSiblings = 1.7;
      
      // Tighten separation as tree grows
      const depthFactor = Math.min(depth * 0.03, 0.3); // Max 30% reduction
      const branchFactor = Math.min(maxBranches * 0.02, 0.2); // Max 20% reduction
      
      return {
        siblings: Math.max(0.9, baseSiblings - depthFactor - branchFactor),
        nonSiblings: Math.max(1.1, baseNonSiblings - depthFactor - branchFactor)
      };
    };
    
    // Fixed translate to ensure consistent positioning
    const translateX = 60; // Start 60px from left for better use of space
    const translateY = 250; // Center vertically
    
    return {
      nodeSize: nodeSize,
      separation: calculateSeparation(),
      zoom: calculateZoom(),
      translate: { x: translateX, y: translateY }
    };
  }, [treeMetrics, containerDimensions.width]);

  const fullTreeConfig = {
    orientation: 'horizontal',
    ...treeConfig,
    scaleExtent: { min: 0.1, max: 3 },
    zoomable: true,
    draggable: true,
    collapsible: false,
    pathFunc: 'diagonal',
    transitionDuration: 300,
    enableLegacyTransitions: false,
    initialDepth: undefined,
    depthFactor: undefined,
    shouldCollapseNeighborNodes: false
  };

  return (
    <div className={`tree-sidebar ${isOpen ? 'open' : ''}`} inert={inert ? true : undefined}>
        <div className="sidebar-header">
          <h2>Conversation Map</h2>
          <div className="header-actions">
            {canCompare && (
              <button
                className={`compare-toggle-btn ${compareMode ? 'active' : ''}`}
                onClick={compareMode ? cancelCompare : enterCompareMode}
                title={compareMode ? 'Exit compare mode' : 'Compare two paths side by side'}
                aria-label={compareMode ? 'Exit compare mode' : 'Compare two paths side by side'}
                aria-pressed={compareMode}
              >
                ⇆ Compare
              </button>
            )}
            <button
              className="refresh-btn"
              onClick={fetchTree}
              disabled={isLoading}
              title="Refresh tree"
              aria-label="Refresh conversation tree"
            >
              ↻
            </button>
          </div>
        </div>

        {compareMode && (
          <div className="compare-banner">
            <div className="compare-banner-info">
              <span className="compare-banner-text">
                Tap two responses to compare them ({selectedForCompare.length}/2)
              </span>
              {selectedForCompare.length > 0 && (
                <div className="compare-chips">
                  {selectedForCompare.map((id, idx) => (
                    <span key={id} className={`compare-chip chip-${idx === 0 ? 'a' : 'b'}`}>
                      <span className="chip-num">{idx + 1}</span>
                      <span className="chip-label">{nodeLabel(findNodeById(rawTreeData, id))}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="compare-banner-actions">
              <button
                className="compare-launch-btn"
                onClick={launchCompare}
                disabled={selectedForCompare.length !== 2}
                aria-label="Open side-by-side comparison"
              >
                Compare
              </button>
              <button
                className="compare-cancel-btn"
                onClick={cancelCompare}
                aria-label="Cancel comparison"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="search-container">
          <input
            type="text"
            className="tree-search-input"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search conversation nodes"
          />
          {searchTerm && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="tree-container" ref={treeContainer}>
          {isLoading ? (
            <div className="tree-loading">Loading tree...</div>
          ) : treeData ? (
            <Tree
              data={treeData}
              {...fullTreeConfig}
              renderCustomNodeElement={renderCustomNode}
              onNodeMouseOver={handleNodeMouseOver}
              onNodeMouseOut={handleNodeMouseOut}
              dimensions={containerDimensions}
            />
          ) : (
            <div className="tree-empty">No conversation yet</div>
          )}
        </div>
        
        <div className="tree-legend">
          <div className="legend-item">
            <span className="legend-dot user"></span> User
          </div>
          <div className="legend-item">
            <span className="legend-dot assistant"></span> Assistant
          </div>
          <div className="legend-item">
            <span className="legend-dot active"></span> Active
          </div>
          {searchTerm && (
            <div className="legend-item">
              <span className="legend-dot search"></span> Match
            </div>
          )}
        </div>
      </div>
  );
}

TreeSidebar.propTypes = {
  sessionId: PropTypes.string,
  onBranchSwitch: PropTypes.func,
  currentBranch: PropTypes.arrayOf(PropTypes.string),
  isOpen: PropTypes.bool.isRequired,
  setIsOpen: PropTypes.func.isRequired,
  onCompare: PropTypes.func,
  inert: PropTypes.bool
};

TreeSidebar.defaultProps = {
  currentBranch: []
};

export default TreeSidebar;