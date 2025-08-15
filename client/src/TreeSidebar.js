import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Tree from 'react-d3-tree';
import axios from 'axios';
import './TreeSidebar.css';

function TreeSidebar({ sessionId, onBranchSwitch, currentBranch, isOpen, setIsOpen }) {
  const [rawTreeData, setRawTreeData] = useState(null);
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const treeContainer = useRef(null);

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
      </g>
    );
  };

  const treeConfig = {
    orientation: 'horizontal',
    nodeSize: { x: 100, y: 160 },
    separation: { siblings: 1.3, nonSiblings: 1.6 },
    translate: { x: 80, y: 200 },
    zoom: 0.8,
    scaleExtent: { min: 0.1, max: 3 },
    zoomable: true,
    draggable: true,
    collapsible: false,
    pathFunc: 'diagonal',
    transitionDuration: treeData && Object.keys(treeData).length > 50 ? 0 : 300,
    enableLegacyTransitions: false,
    initialDepth: undefined,
    depthFactor: undefined,
    shouldCollapseNeighborNodes: false
  };

  return (
    <div className={`tree-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Conversation Map</h2>
          <button
            className="refresh-btn"
            onClick={fetchTree}
            disabled={isLoading}
            title="Refresh tree"
          >
            ↻
          </button>
        </div>
        
        <div className="search-container">
          <input
            type="text"
            className="tree-search-input"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchTerm('')}
              title="Clear search"
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
              {...treeConfig}
              renderCustomNodeElement={renderCustomNode}
              onNodeMouseOver={handleNodeMouseOver}
              onNodeMouseOut={handleNodeMouseOut}
              dimensions={{
                width: treeContainer.current?.offsetWidth || 400,
                height: treeContainer.current?.offsetHeight || 600
              }}
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
  setIsOpen: PropTypes.func.isRequired
};

TreeSidebar.defaultProps = {
  currentBranch: []
};

export default TreeSidebar;