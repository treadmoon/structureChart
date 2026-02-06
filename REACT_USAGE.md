
# 在 React 中使用 OrgChart

这个 OrgChart 插件是基于原生 TypeScript 和 D3.js 开发的，它直接操作 DOM，因此非常容易集成到 React 项目中。

以下是一个标准的封装示例，展示了如何将其包装为 React 组件。

## 1. 封装组件 (OrgChartComponent.tsx)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { OrgChart } from './org-chart/OrgChart'; // 确保路径正确
import type { OrgChartNodeData, OrgChartOptions } from './org-chart/types';
import './org-chart/styles.css'; // 引入样式

interface OrgChartProps {
    data: OrgChartNodeData[];
    mode?: 'view' | 'edit';
    onNodeClick?: (id: string) => void;
    onDataChange?: (data: OrgChartNodeData[]) => void;
}

export const OrgChartComponent: React.FC<OrgChartProps> = ({ 
    data, 
    mode = 'view', 
    onNodeClick, 
    onDataChange 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<OrgChart | null>(null);

    // 1. 初始化图表
    useEffect(() => {
        if (!containerRef.current) return;

        // 定义图表配置
        const options: OrgChartOptions = {
            nodeWidth: 200,
            nodeHeight: 100,
            nodeSpacingX: 30,
            nodeSpacingY: 60,
            renderContent: (d) => {
                // 这里可以使用模板字符串返回 HTML
                // 注意：在 React 中通常不建议在 renderContent 里写复杂的交互逻辑
                // 如果需要复杂交互，建议使用简单 HTML + 委托事件，或者 React Portal (较复杂)
                return `
                    <div class="org-card-dept" style="width:100%; height:100%;">
                        <div class="org-card-name" style="text-align:center; padding-top:10px;">${d.name}</div>
                        <div class="org-card-title" style="text-align:center;">${d['title'] || ''}</div>
                    </div>
                `;
            },
            onNodeClick: (id) => {
                if (onNodeClick) onNodeClick(id);
            },
            onDataChange: (newData) => {
                if (onDataChange) onDataChange(newData);
            }
        };

        // 实例化
        chartRef.current = new OrgChart(containerRef.current, options);
        
        // 渲染初始数据
        chartRef.current.render(data);

        // 清理函数 (可选，如果 OrgChart 有绑定全局事件需要解绑)
        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = ''; // 清空容器
            }
            chartRef.current = null;
        };
        // 注意：这里依赖项为空数组，只在挂载时实例化一次
        // 如果 options 需要动态变化，逻辑会稍微复杂一点
    }, []);

    // 2. 响应数据变化
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.render(data);
        }
    }, [data]);

    // 3. 响应模式变化 (View/Edit)
    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.setMode(mode);
        }
    }, [mode]);

    return (
        <div 
            ref={containerRef} 
            className="org-chart-wrapper" 
            style={{ width: '100%', height: '600px', border: '1px solid #eee' }} // 确保容器有高度
        />
    );
};
```

## 2. 使用组件 (App.tsx)

```tsx
import React, { useState } from 'react';
import { OrgChartComponent } from './OrgChartComponent';

const App = () => {
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [data, setData] = useState([
        { id: '1', parentId: null, name: 'CEO', title: 'President' },
        { id: '2', parentId: '1', name: 'CTO', title: 'Technology' },
        { id: '3', parentId: '1', name: 'CFO', title: 'Finance' },
    ]);

    return (
        <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 10 }}>
                <button onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}>
                    Current Mode: {mode}
                </button>
            </div>
            
            <OrgChartComponent 
                data={data} 
                mode={mode}
                onNodeClick={(id) => console.log('Clicked', id)}
                onDataChange={(newData) => {
                    console.log('Data updated', newData);
                    setData(newData); // 同步 react 状态
                }}
            />
        </div>
    );
};

export default App;
```

## 3. 注意事项

1.  **样式引入**：别忘了引入 `styles.css`，或者确保其中的 CSS 变量在你的 React 环境中生效。
2.  **DOM 操作**：因为 D3 接管了 `containerRef` 内部的 DOM，所以不要让 React 去尝试渲染该 `div` 的子元素。
3.  **复杂组件渲染**：目前 `renderContent` 返回的是 HTML 字符串。如果你想在卡片里拥有复杂的 React 组件（比如 Material UI 的按钮），你需要使用 `ReactDOM.render` (React 17) 或 `createRoot` (React 18) 将 React 组件挂载到 D3 创建的每一个节点中。这个稍微高级一点，如果需要可以进一步扩展。
