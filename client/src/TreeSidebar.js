import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Tree from 'react-d3-tree';
import axios from 'axios';
import './TreeSidebar.css';

function TreeSidebar({ sessionId, onBranchSwitch, currentBranch, isOpen, setIsOpen }) {
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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
      const transformedTree = transformTreeData(response.data.tree);
      setTreeData(transformedTree);
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

  const transformTreeData = (node) => {
    if (!node) return null;
    
    const truncateContent = (content) => {
      if (content.length > 30) {
        return content.substring(0, 30) + '...';
      }
      return content;
    };
    
    const isInCurrentBranch = currentBranch && currentBranch.includes(node.id);
    
    return {
      name: truncateContent(node.content),
      attributes: {
        id: node.id,
        role: node.role,
        isActive: isInCurrentBranch
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

  const renderCustomNode = ({ nodeDatum }) => {
    const isUser = nodeDatum.attributes.role === 'user';
    const isActive = nodeDatum.attributes.isActive;
    
    return (
      <g onClick={() => handleNodeClick({ data: nodeDatum })}>
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
            <stop offset="0%" stopColor={isActive ? '#a855f7' : (isUser ? '#9ca3af' : '#60a5fa')} />
            <stop offset="100%" stopColor={isActive ? '#7c3aed' : (isUser ? '#6b7280' : '#3b82f6')} />
          </linearGradient>
        </defs>
        <circle
          r="22"
          fill={`url(#gradient-${nodeDatum.attributes.id})`}
          stroke={isActive ? '#9333ea' : '#ffffff'}
          strokeWidth={isActive ? "3" : "2"}
          filter="url(#nodeShadow)"
          style={{ 
            cursor: 'pointer',
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
          {isUser ? 'U' : 'A'}
        </text>
        <foreignObject x="-70" y="32" width="140" height="45">
          <div style={{
            fontSize: '11px',
            textAlign: 'center',
            color: isActive ? '#7c3aed' : '#4b5563',
            wordWrap: 'break-word',
            lineHeight: '1.3',
            fontWeight: isActive ? '500' : '400',
            padding: '4px',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            pointerEvents: 'none'
          }}>
            {nodeDatum.name}
          </div>
        </foreignObject>
      </g>
    );
  };

  const treeConfig = {
    orientation: 'horizontal',
    nodeSize: { x: 110, y: 160 },
    separation: { siblings: 1.2, nonSiblings: 2 },
    translate: { x: 60, y: 200 },
    zoom: 0.75,
    scaleExtent: { min: 0.1, max: 2 },
    zoomable: true,
    draggable: true,
    collapsible: false,
    pathFunc: 'diagonal',
    transitionDuration: 500
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
        
        <div className="tree-container" ref={treeContainer}>
          {isLoading ? (
            <div className="tree-loading">Loading tree...</div>
          ) : treeData ? (
            <Tree
              data={treeData}
              {...treeConfig}
              renderCustomNodeElement={renderCustomNode}
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