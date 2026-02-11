# 在 React 中使用 OrgChart

为了方便在 React 项目中使用，推荐创建一个封装组件。

### 1. 封装 React 组件 (`OrgChartContainer.tsx`)

```tsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { OrgChart } from './plugin/OrgChart'; // 根据你的项目结构调整路径
import type { OrgChartNodeData, OrgChartOptions } from './plugin/types';
import './plugin/styles.css'; // 导入插件样式

interface OrgChartProps {
  data: OrgChartNodeData[];
  mode?: 'view' | 'edit';
  options?: Partial<OrgChartOptions>;
  onNodeClick?: (id: string) => void;
  onDataChange?: (data: OrgChartNodeData[]) => void;
}

export interface OrgChartHandle {
  fitToScreen: () => void;
  centerNode: (nodeId: string) => void;
  instance: OrgChart | null;
}

export const ReactOrgChart = forwardRef<OrgChartHandle, OrgChartProps>(({
  data,
  mode = 'view',
  options = {},
  onNodeClick,
  onDataChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<OrgChart | null>(null);

  // 初始化
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new OrgChart(containerRef.current, {
      nodeWidth: 200,
      nodeHeight: 120,
      nodeSpacingX: 40,
      nodeSpacingY: 80,
      renderContent: (d) => `
        <div class="custom-react-card">
          <div class="name">${d.name}</div>
          <div class="title">${d.title}</div>
        </div>
      `,
      ...options,
      onNodeClick,
      onDataChange: (newData) => {
        if (onDataChange) onDataChange(newData);
      }
    });

    chartInstance.current = chart;
    chart.render(data);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      chartInstance.current = null;
    };
  }, []); // 仅在初始化时执行一次

  // 暴露 API 给父组件
  useImperativeHandle(ref, () => ({
    fitToScreen: () => chartInstance.current?.fitToScreen(),
    centerNode: (id: string) => chartInstance.current?.centerNode(id),
    instance: chartInstance.current
  }));

  // 同步数据变化
  useEffect(() => {
    chartInstance.current?.render(data);
  }, [data]);

  // 同步模式切换
  useEffect(() => {
    chartInstance.current?.setMode(mode);
  }, [mode]);

  return (
    <div 
      ref={containerRef} 
      className="org-chart-react-wrapper" 
      style={{ width: '100%', height: '100%', minHeight: '500px', background: '#f8f9fa' }}
    />
  );
});
```

### 2. 完整业务代码示例 (`App.tsx`)

```tsx
import React, { useState, useRef } from 'react';
import { ReactOrgChart, OrgChartHandle } from './OrgChartContainer';

const initialData = [
  { id: '1', parentId: null, name: '张三', title: '总经理' },
  { id: '2', parentId: '1', name: '李四', title: '技术总监' },
  { id: '3', parentId: '1', name: '王五', title: '人力总监' },
];

export default function App() {
  const [chartData, setChartData] = useState(initialData);
  const [isEditMode, setIsEditMode] = useState(false);
  const chartRef = useRef<OrgChartHandle>(null);

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1>组织架构管理系统</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setIsEditMode(!isEditMode)}>
          {isEditMode ? '完成切换到视图模式' : '开启拖拽编辑模式'}
        </button>
        <button onClick={() => chartRef.current?.fitToScreen()}>自适应屏幕</button>
        <button onClick={() => chartRef.current?.centerNode('1')}>定位到根节点</button>
      </div>

      <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
        <ReactOrgChart
          ref={chartRef}
          data={chartData}
          mode={isEditMode ? 'edit' : 'view'}
          onDataChange={(newData) => {
            console.log('数据结构已更新:', newData);
            setChartData(newData);
          }}
          onNodeClick={(id) => alert('点击了节点 ID: ' + id)}
        />
      </div>
    </div>
  );
}
```

### 3. 配置说明

1.  **依赖安装**：在你的 React 项目中，需要安装 D3：`npm install d3 @types/d3`。
2.  **样式覆盖**：你可以通过在 CSS 中定义 `.custom-react-card` 或者覆盖插件默认的 `.org-chart-node` 类名来定制 UI。
3.  **Ref 交互**：通过 `useImperativeHandle` 暴露了 `fitToScreen` 等 API，方便外部可以通过按钮控制图表。
