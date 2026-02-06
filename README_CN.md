# Structure Chart - 动态组织架构图

本项目是一个基于 D3.js 和 TypeScript 开发的高可定制化、交互式组织架构图组件。它支持拖拽编辑、缩放平移、节点折叠/展开以及多种视觉模板。

## ✨ 功能特性

- **交互性强**:
  - 🖱️ **平移与缩放**: 使用 D3 zoom 行为实现流畅的画布导航。
  - 📂 **折叠/展开**: 通过点击节点的 `+`/`-` 按钮轻松切换下级节点的显示与隐藏。
  - 🔍 **搜索与定位**: 支持通过 ID 快速搜索并自动聚焦到指定节点。
- **支持编辑**:
  - ✋ **拖拽排序**: 在“编辑模式”下，可视化地拖拽卡片以调整同级顺序或更改上级汇报关系。
  - 👻 **视觉反馈**: 拖拽过程中显示半透明的“幽灵”卡片和清晰的放置位置指示器。
- **高度定制**:
  - 🎨 **多套模板**: 内置多种业务风格模板：
    - **五大中心 (5-Centers)**: 针对 CEO、研发、销售、产品、行政中心提供区分明显的配色风格。
    - **集团/公司/部门**: 传统的企业层级风格。
  - 🛠️ **框架无关**:以此原生 TypeScript 编写，可轻松集成到 React, Vue, 或 Angular 项目中。

## 🚀 快速开始

### 前置要求

- 已安装 Node.js
- npm 或 yarn

### 安装

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建

```bash
# 生产环境构建
npm run build
```

## 📖 使用指南

### 基础初始化

```typescript
import { OrgChart } from './org-chart/OrgChart';

const container = document.getElementById('chart-container');
const data = [
  { id: '1', parentId: null, name: 'CEO' },
  { id: '2', parentId: '1', name: 'CTO' }
];

const chart = new OrgChart(container, {
  nodeWidth: 200,
  nodeHeight: 100,
  // 自定义卡片内容的渲染函数，返回 HTML 字符串
  renderContent: (d) => `<div class="card">${d.name}</div>`,
  onNodeClick: (id) => console.log('点击了节点:', id)
});

// 渲染数据
chart.render(data);
```

### React 集成

请参阅 [REACT_USAGE.md](./REACT_USAGE.md) 获取如何在 React 应用中封装此组件的详细指南。

## 📂 项目结构

```
src/
├── org-chart/
│   ├── OrgChart.ts       # 核心逻辑 (D3 布局, 交互事件)
│   ├── types.ts          # TypeScript 类型定义
│   ├── templates.ts      # 卡片 HTML 模板生成函数
│   └── styles.css        # 核心样式 & 模板主题
├── main.ts               # Demo 应用入口文件
└── style.css             # 全局样式
```

## 🛠️ API 配置项 (Options)

| 选项名 | 类型 | 描述 |
|--------|------|-------------|
| `nodeWidth` | `number` | 节点卡片的宽度 (像素). 默认: 200 |
| `nodeHeight` | `number` | 节点卡片的高度 (像素). 默认: 100 |
| `renderContent` | `(data) => string` | 用于生成节点内部 HTML 内容的回调函数。 |
| `onNodeClick` | `(id) => void` | 当节点被点击时的回调函数。 |
| `onNodeDrop` | `(src, tgt) => void` | 当节点被拖拽放置时的回调函数 (仅编辑模式有效)。 |
| `onDataChange` | `(data) => void` | 当数据结构发生变化（如拖拽改变层级）时的回调。 |

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进图表渲染效果或添加新功能！
