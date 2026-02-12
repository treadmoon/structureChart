
import React, { useState, useRef } from 'react';
import { ReactOrgChart, type OrgChartHandle } from './OrgChartContainer';
import type { OrgChartNodeData } from '../../plugin/types';

const INITIAL_DATA: OrgChartNodeData[] = [
    { id: '1', parentId: null, name: '张辉', title: 'CEO' },
    { id: '2', parentId: '1', name: '李智', title: 'CTO' },
    { id: '3', parentId: '1', name: '王敏', title: 'CFO' },
    { id: '4', parentId: '2', name: '陈刚', title: '前端架构师' },
    { id: '5', parentId: '2', name: '刘洋', title: '后端架构师' },
    { id: '6', parentId: '3', name: '赵丽', title: '财务主管' },
    { id: '7', parentId: '4', name: '孙强', title: '高级前端' },
];

export default function App() {
    const [chartData, setChartData] = useState(INITIAL_DATA);
    const [isEditMode, setIsEditMode] = useState(false);
    const chartRef = useRef<OrgChartHandle>(null);

    const handleDataChange = (newData: OrgChartNodeData[]) => {
        console.log('Data structure updated:', newData);
        setChartData(newData);
    };

    const handleAddChild = () => {
        // Demo: add child to root
        const newId = String(Date.now());
        const newNode: OrgChartNodeData = {
            id: newId,
            parentId: '1',
            name: '新员工',
            title: '实习生'
        };
        setChartData([...chartData, newNode]);
        setTimeout(() => {
            chartRef.current?.centerNode(newId);
        }, 100);
    };

    return (
        <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => setIsEditMode(!isEditMode)} style={{ padding: '8px 16px', background: isEditMode ? '#ff4d4f' : '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {isEditMode ? '关闭编辑模式' : '开启编辑模式 (支持拖拽)'}
                </button>
                <button onClick={() => chartRef.current?.fitToScreen()} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' }}>
                    自适应屏幕
                </button>
                <button onClick={() => chartRef.current?.centerNode('1')} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' }}>
                    定位到 CEO
                </button>
                <button onClick={handleAddChild} style={{ padding: '8px 16px', background: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    添加节点到 CEO 下
                </button>
            </div>

            <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                <ReactOrgChart
                    ref={chartRef}
                    data={chartData}
                    mode={isEditMode ? 'edit' : 'view'}
                    onDataChange={handleDataChange}
                    onNodeClick={(id) => console.log('Clicked node:', id)}
                />
                <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(255,255,255,0.8)', padding: 5, fontSize: 12 }}>
                    Node Count: {chartData.length}
                </div>
            </div>
        </div>
    );
}
